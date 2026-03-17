/**
 * Intervention Engine
 *
 * The brain of the Membership Agent. Selects and executes interventions
 * for at-risk members based on churn score, channel preference, and
 * operator-configured guardrails.
 *
 * CRITICAL: All customer-facing messages come from templates.
 * The LLM never generates freeform customer text.
 */

import { createServerClient } from '@/lib/db/client';
import { sendSMS } from '@/lib/comms/sms';
import { sendEmail } from '@/lib/comms/email';
import { renderTemplate, buildVariables } from '@/lib/comms/template-renderer';
import { calculateChurnScore } from './churn-scorer';

interface Member {
  id: string;
  site_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  plan_name: string | null;
  plan_price_cents: number | null;
  plan_start_date: string | null;
  plan_status: string;
  payment_status: string;
  payment_failure_count: number;
  churn_score: number;
  wash_count_30d: number;
  wash_count_total: number;
  avg_wash_frequency_days: number | null;
  last_wash_date: string | null;
  do_not_contact: boolean;
}

interface Template {
  id: string;
  template_type: string;
  channel: string;
  name: string;
  subject: string | null;
  body: string;
  offer_type: string | null;
  offer_value: string | null;
  priority: number;
}

interface Site {
  id: string;
  name: string;
  organization_id: string;
}

interface InterventionResult {
  success: boolean;
  member_id: string;
  action_type: string;
  channel: string;
  template_id: string;
  message_id?: string;
  error?: string;
}

const CHURN_THRESHOLD = 60; // Score at which we intervene
const MIN_DAYS_BETWEEN_CONTACT = 7; // Don't over-message

/**
 * Run churn check for all active members at a site.
 * Updates churn scores and triggers interventions for at-risk members.
 */
export async function runChurnCheck(siteId: string): Promise<{
  membersChecked: number;
  interventionsSent: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const errors: string[] = [];
  let interventionsSent = 0;

  // Get site info
  const { data: site } = await supabase
    .from('sites')
    .select('*, organizations(*)')
    .eq('id', siteId)
    .single();

  if (!site) {
    return { membersChecked: 0, interventionsSent: 0, errors: ['Site not found'] };
  }

  // Get all active members
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('*')
    .eq('site_id', siteId)
    .eq('plan_status', 'active')
    .eq('do_not_contact', false);

  if (membersError || !members) {
    return { membersChecked: 0, interventionsSent: 0, errors: [membersError?.message || 'No members'] };
  }

  // Update churn scores for all members
  for (const member of members) {
    const daysSinceLastWash = member.last_wash_date
      ? Math.floor((Date.now() - new Date(member.last_wash_date).getTime()) / (24 * 60 * 60 * 1000))
      : null;

    const planAgeDays = member.plan_start_date
      ? Math.floor((Date.now() - new Date(member.plan_start_date).getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    // Calculate payment failure count (use status as fallback)
    let paymentFailureCount = member.payment_failure_count || 0;
    if (paymentFailureCount === 0 && member.payment_status === 'declined') {
      paymentFailureCount = 1;
    }

    const { score } = calculateChurnScore({
      wash_count_30d: member.wash_count_30d,
      wash_count_60d: member.wash_count_30d,
      avg_wash_frequency_days: member.avg_wash_frequency_days,
      days_since_last_wash: daysSinceLastWash,
      payment_failure_count: paymentFailureCount,
      plan_age_days: planAgeDays,
      month: new Date().getMonth() + 1,
    });

    // Update churn score
    await supabase
      .from('members')
      .update({
        churn_score: score,
        churn_score_updated_at: new Date().toISOString(),
      })
      .eq('id', member.id);

    // If above threshold, attempt intervention
    if (score >= CHURN_THRESHOLD) {
      const result = await executeIntervention(member, site, 'churn_winback');
      if (result.success) {
        interventionsSent++;
      } else if (result.error) {
        errors.push(`${member.first_name}: ${result.error}`);
      }
    }
  }

  return {
    membersChecked: members.length,
    interventionsSent,
    errors,
  };
}

/**
 * Execute a single intervention for a member.
 */
export async function executeIntervention(
  member: Member,
  site: Site & { organizations: any },
  interventionType: string
): Promise<InterventionResult> {
  const supabase = createServerClient();

  // Check guardrails: was this member contacted recently?
  const { data: recentActions } = await supabase
    .from('agent_actions')
    .select('created_at')
    .eq('target_id', member.id)
    .eq('target_type', 'member')
    .eq('status', 'executed')
    .gte('created_at', new Date(Date.now() - MIN_DAYS_BETWEEN_CONTACT * 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (recentActions && recentActions.length > 0) {
    return {
      success: false,
      member_id: member.id,
      action_type: interventionType,
      channel: 'none',
      template_id: '',
      error: 'Contacted recently - guardrail blocked',
    };
  }

  // Select channel based on churn score and available contact info
  let channel: 'sms' | 'email';
  if (member.churn_score >= 80 && member.phone) {
    channel = 'sms'; // High urgency = SMS
  } else if (member.email) {
    channel = 'email';
  } else if (member.phone) {
    channel = 'sms';
  } else {
    return {
      success: false,
      member_id: member.id,
      action_type: interventionType,
      channel: 'none',
      template_id: '',
      error: 'No contact info available',
    };
  }

  // Get the best template
  const { data: templates } = await supabase
    .from('intervention_templates')
    .select('*')
    .eq('organization_id', site.organization_id)
    .eq('template_type', interventionType)
    .eq('channel', channel)
    .eq('active', true)
    .order('priority', { ascending: false })
    .limit(1);

  if (!templates || templates.length === 0) {
    return {
      success: false,
      member_id: member.id,
      action_type: interventionType,
      channel,
      template_id: '',
      error: `No ${channel} template found for ${interventionType}`,
    };
  }

  const template = templates[0] as Template;

  // Build template variables
  const variables = buildVariables(
    {
      first_name: member.first_name,
      last_name: member.last_name,
      plan_name: member.plan_name,
      plan_price_cents: member.plan_price_cents,
      wash_count_total: member.wash_count_total,
      wash_count_30d: member.wash_count_30d,
      plan_start_date: member.plan_start_date,
    },
    { name: site.name },
    { details: template.offer_value || '' }
  );

  // Render message
  const messageBody = renderTemplate(template.body, variables);
  const messageSubject = template.subject ? renderTemplate(template.subject, variables) : '';

  // Send message
  let sendResult: { success: boolean; message_sid?: string; error?: string };

  if (channel === 'sms') {
    sendResult = await sendSMS(member.phone!, messageBody);
  } else {
    const emailResult = await sendEmail(member.email!, messageSubject, messageBody);
    sendResult = { success: emailResult.success, error: emailResult.error };
  }

  // Log action
  const actionData = {
    site_id: site.id,
    agent: 'membership',
    action_type: interventionType,
    tier: 1,
    status: sendResult.success ? 'executed' : 'failed',
    target_type: 'member',
    target_id: member.id,
    decision_data: {
      churn_score: member.churn_score,
      wash_count_30d: member.wash_count_30d,
      days_since_last_wash: member.last_wash_date
        ? Math.floor((Date.now() - new Date(member.last_wash_date).getTime()) / (24 * 60 * 60 * 1000))
        : null,
    },
    action_data: {
      channel,
      template_id: template.id,
      template_name: template.name,
      offer_type: template.offer_type,
      message_preview: messageBody.substring(0, 100),
      message_sid: sendResult.message_sid,
    },
  };

  await supabase.from('agent_actions').insert(actionData);

  return {
    success: sendResult.success,
    member_id: member.id,
    action_type: interventionType,
    channel,
    template_id: template.id,
    message_id: sendResult.message_sid,
    error: sendResult.error,
  };
}

/**
 * Process credit card retries for members with declined payments.
 * Uses payday logic: 1st and 15th of month are optimal retry days.
 */
export async function runCCRecovery(siteId: string): Promise<{
  membersProcessed: number;
  messagesSent: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const errors: string[] = [];
  let messagesSent = 0;

  // Get site info
  const { data: site } = await supabase
    .from('sites')
    .select('*, organizations(*)')
    .eq('id', siteId)
    .single();

  if (!site) {
    return { membersProcessed: 0, messagesSent: 0, errors: ['Site not found'] };
  }

  // Get members with declined payments
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('site_id', siteId)
    .in('payment_status', ['declined', 'retry_pending'])
    .eq('do_not_contact', false);

  if (!members || members.length === 0) {
    return { membersProcessed: 0, messagesSent: 0, errors: [] };
  }

  // Check if today is a payday (1st or 15th)
  const today = new Date();
  const dayOfMonth = today.getDate();
  const isPayday = dayOfMonth === 1 || dayOfMonth === 15;
  const isNearPayday = dayOfMonth <= 2 || (dayOfMonth >= 14 && dayOfMonth <= 16);

  for (const member of members) {
    const daysSinceFailure = member.last_payment_failure
      ? Math.floor((Date.now() - new Date(member.last_payment_failure).getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    // Smart retry logic:
    // 1. Wait at least 2 days after failure
    // 2. Prefer paydays (1st/15th) for retry reminders
    // 3. After 7+ days, send regardless if not yet contacted
    let shouldRetry = false;

    if (daysSinceFailure < 2) {
      // Too soon, wait
      shouldRetry = false;
    } else if (daysSinceFailure >= 14) {
      // Urgent: over 2 weeks, send now
      shouldRetry = true;
    } else if (isPayday && daysSinceFailure >= 2) {
      // It's payday and been at least 2 days - optimal time
      shouldRetry = true;
    } else if (isNearPayday && daysSinceFailure >= 5) {
      // Near payday and been 5+ days
      shouldRetry = true;
    } else if (daysSinceFailure >= 7 && member.payment_failure_count <= 2) {
      // Week passed, send a reminder
      shouldRetry = true;
    }

    if (shouldRetry) {
      const result = await executeIntervention(member, site, 'cc_recovery');
      if (result.success) {
        messagesSent++;
        // Update payment failure tracking
        await supabase
          .from('members')
          .update({
            payment_failure_count: (member.payment_failure_count || 0) + 1,
            payment_status: 'retry_pending',
          })
          .eq('id', member.id);
      } else if (result.error) {
        errors.push(`${member.first_name}: ${result.error}`);
      }
    }
  }

  return {
    membersProcessed: members.length,
    messagesSent,
    errors,
  };
}

/**
 * Process onboarding drip sequences for new members.
 * Schedule:
 *   Day 1: Welcome email
 *   Day 7: Check-in SMS
 *   Day 30: Milestone email with wash count
 */
export async function runOnboardingDrips(siteId: string): Promise<{
  membersProcessed: number;
  messagesSent: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const errors: string[] = [];
  let messagesSent = 0;

  // Get site info
  const { data: site } = await supabase
    .from('sites')
    .select('*, organizations(*)')
    .eq('id', siteId)
    .single();

  if (!site) {
    return { membersProcessed: 0, messagesSent: 0, errors: ['Site not found'] };
  }

  // Drip schedule: step -> { day, template_name, channel }
  const dripSchedule = [
    { day: 1, templateName: 'Welcome Day 1', channel: 'email' },
    { day: 7, templateName: 'Welcome Day 7', channel: 'sms' },
    { day: 30, templateName: 'Welcome Day 30', channel: 'email' },
  ];

  // Get new members in onboarding (joined within last 45 days, not completed)
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('site_id', siteId)
    .eq('plan_status', 'active')
    .eq('do_not_contact', false)
    .gte('created_at', fortyFiveDaysAgo)
    .or('drip_step.is.null,drip_step.lt.3');

  if (!members || members.length === 0) {
    return { membersProcessed: 0, messagesSent: 0, errors: [] };
  }

  for (const member of members) {
    // Calculate member age in days
    const joinDate = member.plan_start_date || member.created_at;
    const memberAgeDays = Math.floor(
      (Date.now() - new Date(joinDate).getTime()) / (24 * 60 * 60 * 1000)
    );

    const currentStep = member.drip_step || 0;

    // Find the next drip to send
    let dripToSend = null;
    for (let i = currentStep; i < dripSchedule.length; i++) {
      const drip = dripSchedule[i];
      if (memberAgeDays >= drip.day) {
        dripToSend = { ...drip, nextStep: i + 1 };
      }
    }

    if (dripToSend && dripToSend.nextStep > currentStep) {
      // Send the onboarding message using the specific template
      const result = await sendOnboardingMessage(
        member,
        site,
        dripToSend.templateName,
        dripToSend.channel as 'sms' | 'email'
      );

      if (result.success) {
        messagesSent++;
        // Update drip step
        await supabase
          .from('members')
          .update({
            drip_step: dripToSend.nextStep,
            onboarding_step: dripToSend.nextStep, // Keep legacy field updated too
          })
          .eq('id', member.id);
      } else if (result.error && !result.error.includes('guardrail')) {
        errors.push(`${member.first_name}: ${result.error}`);
      }
    }
  }

  return {
    membersProcessed: members.length,
    messagesSent,
    errors,
  };
}

/**
 * Send an onboarding message using a specific template by name.
 */
async function sendOnboardingMessage(
  member: Member,
  site: Site & { organizations: any },
  templateName: string,
  channel: 'sms' | 'email'
): Promise<InterventionResult> {
  const supabase = createServerClient();

  // Check guardrails
  const { data: recentActions } = await supabase
    .from('agent_actions')
    .select('created_at')
    .eq('target_id', member.id)
    .eq('target_type', 'member')
    .eq('status', 'executed')
    .gte('created_at', new Date(Date.now() - MIN_DAYS_BETWEEN_CONTACT * 24 * 60 * 60 * 1000).toISOString())
    .limit(1);

  if (recentActions && recentActions.length > 0) {
    return {
      success: false,
      member_id: member.id,
      action_type: 'onboarding',
      channel,
      template_id: '',
      error: 'Contacted recently - guardrail blocked',
    };
  }

  // Get the template by name
  const { data: templates } = await supabase
    .from('intervention_templates')
    .select('*')
    .eq('organization_id', site.organization_id)
    .eq('name', templateName)
    .eq('channel', channel)
    .eq('active', true)
    .limit(1);

  let templateToUse = templates?.[0];

  if (!templateToUse) {
    // Try getting any welcome template for this channel
    const { data: fallbackTemplates } = await supabase
      .from('intervention_templates')
      .select('*')
      .eq('organization_id', site.organization_id)
      .eq('template_type', 'welcome')
      .eq('channel', channel)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(1);

    if (!fallbackTemplates || fallbackTemplates.length === 0) {
      return {
        success: false,
        member_id: member.id,
        action_type: 'onboarding',
        channel,
        template_id: '',
        error: `No ${channel} template found for ${templateName}`,
      };
    }

    templateToUse = fallbackTemplates[0];
  }

  const template = templateToUse as Template;

  // Build variables
  const variables = buildVariables(
    {
      first_name: member.first_name,
      last_name: member.last_name,
      plan_name: member.plan_name,
      plan_price_cents: member.plan_price_cents,
      wash_count_total: member.wash_count_total,
      wash_count_30d: member.wash_count_30d,
      plan_start_date: member.plan_start_date,
    },
    { name: site.name },
    { details: '' }
  );

  // Render message
  const messageBody = renderTemplate(template.body, variables);
  const messageSubject = template.subject ? renderTemplate(template.subject, variables) : '';

  // Send
  let sendResult: { success: boolean; message_sid?: string; error?: string };

  if (channel === 'sms' && member.phone) {
    sendResult = await sendSMS(member.phone, messageBody);
  } else if (channel === 'email' && member.email) {
    const emailResult = await sendEmail(member.email, messageSubject, messageBody);
    sendResult = { success: emailResult.success, error: emailResult.error };
  } else {
    return {
      success: false,
      member_id: member.id,
      action_type: 'onboarding',
      channel,
      template_id: template.id,
      error: `No ${channel} contact info for member`,
    };
  }

  // Log action
  await supabase.from('agent_actions').insert({
    site_id: site.id,
    agent: 'membership',
    action_type: 'onboarding',
    tier: 1,
    status: sendResult.success ? 'executed' : 'failed',
    target_type: 'member',
    target_id: member.id,
    decision_data: {
      template_name: templateName,
      member_age_days: member.plan_start_date
        ? Math.floor((Date.now() - new Date(member.plan_start_date).getTime()) / (24 * 60 * 60 * 1000))
        : 0,
    },
    action_data: {
      channel,
      template_id: template.id,
      template_name: template.name,
      message_preview: messageBody.substring(0, 100),
    },
  });

  return {
    success: sendResult.success,
    member_id: member.id,
    action_type: 'onboarding',
    channel,
    template_id: template.id,
    message_id: sendResult.message_sid,
    error: sendResult.error,
  };
}
