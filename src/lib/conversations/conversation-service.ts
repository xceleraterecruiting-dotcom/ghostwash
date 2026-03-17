/**
 * Conversation Service
 *
 * Handles the full inbound message flow:
 * 1. Match phone to site and member
 * 2. Find or create conversation thread
 * 3. Classify intent
 * 4. Check escalation rules
 * 5. Select and render response template
 * 6. Send response
 * 7. Log everything
 */

import { createServerClient } from '@/lib/db/client';
import {
  classifyIntent,
  checkEscalationTriggers,
  getTemplateForIntent,
  requiresOperatorNotification,
  IntentCategory,
  ClassificationResult,
} from './intent-classifier';
import { renderTemplate, buildVariables } from '@/lib/comms/template-renderer';
import { sendSMS } from '@/lib/comms/sms';

interface InboundMessage {
  from: string; // Customer phone number
  to: string; // Twilio number (maps to site)
  body: string;
  twilioSid?: string;
  channel: 'sms' | 'voice';
}

interface ProcessingResult {
  success: boolean;
  threadId: string;
  messageId: string;
  intent: IntentCategory;
  confidence: number;
  autoResponded: boolean;
  escalated: boolean;
  escalationReason?: string;
  responseSent?: string;
  error?: string;
}

interface ConversationThread {
  id: string;
  site_id: string;
  member_id: string | null;
  member_phone: string;
  status: string;
  intent: string | null;
  message_count: number;
}

interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  plan_name: string | null;
  plan_price_cents: number | null;
  wash_count_total: number;
  wash_count_30d: number;
  plan_start_date: string | null;
  tags: string[] | null;
}

interface Site {
  id: string;
  name: string;
  organization_id: string;
  twilio_number: string | null;
}

const CONFIDENCE_THRESHOLD = 0.7;
const MAX_MESSAGES_BEFORE_HANDOFF = 3;
const THREAD_TIMEOUT_HOURS = 24;

export async function processInboundMessage(
  message: InboundMessage
): Promise<ProcessingResult> {
  const supabase = createServerClient();

  try {
    // 1. Find site by Twilio number
    const { data: site } = await supabase
      .from('sites')
      .select('*, organizations(*)')
      .eq('twilio_number', message.to)
      .single();

    if (!site) {
      console.error('No site found for Twilio number:', message.to);
      return {
        success: false,
        threadId: '',
        messageId: '',
        intent: 'other',
        confidence: 0,
        autoResponded: false,
        escalated: false,
        error: 'Site not found for this number',
      };
    }

    // 2. Find member by phone number
    const normalizedPhone = normalizePhone(message.from);
    const { data: member } = await supabase
      .from('members')
      .select('*')
      .eq('site_id', site.id)
      .eq('phone', normalizedPhone)
      .single();

    // 3. Find or create conversation thread
    const thread = await findOrCreateThread(
      supabase,
      site.id,
      member?.id || null,
      normalizedPhone
    );

    // 4. Get conversation context (last few messages)
    const context = await getConversationContext(supabase, thread.id);

    // 5. Check escalation triggers first
    const escalationCheck = checkEscalationTriggers(message.body);

    // 6. Classify intent
    const classification = await classifyIntent(message.body, context);

    // 7. Determine if we should auto-respond
    let shouldAutoRespond = true;
    let escalated = escalationCheck.shouldEscalate;
    let escalationReason = escalationCheck.reason;

    // Escalation rules
    if (escalationCheck.shouldEscalate) {
      shouldAutoRespond = false;
    } else if (classification.confidence < CONFIDENCE_THRESHOLD) {
      shouldAutoRespond = false;
      escalated = true;
      escalationReason = 'low_confidence';
    } else if (thread.message_count >= MAX_MESSAGES_BEFORE_HANDOFF) {
      shouldAutoRespond = false;
      escalated = true;
      escalationReason = 'max_messages_reached';
    } else if (classification.intent === 'cancel_request' && member?.tags?.includes('VIP')) {
      // VIP cancel requests: auto-respond BUT also notify operator
      escalated = true;
      escalationReason = 'vip_cancel_request';
    }

    // 8. Log inbound message
    const { data: inboundRecord } = await supabase
      .from('customer_conversations')
      .insert({
        thread_id: thread.id,
        site_id: site.id,
        member_id: member?.id || null,
        direction: 'inbound',
        channel: message.channel,
        message_text: message.body,
        classified_intent: classification.intent,
        confidence_score: classification.confidence,
        status: escalated ? 'escalated' : 'handled',
        twilio_sid: message.twilioSid,
        from_number: message.from,
        to_number: message.to,
      })
      .select()
      .single();

    // 9. Update thread
    await supabase
      .from('conversation_threads')
      .update({
        message_count: thread.message_count + 1,
        last_message_at: new Date().toISOString(),
        intent: classification.intent,
        status: escalated ? 'escalated' : 'open',
        escalation_reason: escalationReason || null,
      })
      .eq('id', thread.id);

    let responseSent: string | undefined;

    // 10. Send auto-response if appropriate
    if (shouldAutoRespond && member) {
      const response = await sendAutoResponse(
        supabase,
        site,
        member,
        thread,
        classification.intent
      );

      if (response.success) {
        responseSent = response.messageText;

        // Log outbound message
        await supabase.from('customer_conversations').insert({
          thread_id: thread.id,
          site_id: site.id,
          member_id: member.id,
          direction: 'outbound',
          channel: 'sms',
          message_text: response.messageText,
          template_used: response.templateName,
          status: 'handled',
          from_number: message.to,
          to_number: message.from,
        });

        // Update thread with outcome if applicable
        if (classification.intent === 'cancel_request') {
          await supabase
            .from('conversation_threads')
            .update({ outcome: 'pending' })
            .eq('id', thread.id);
        }
      }
    }

    // 11. Notify operator if needed
    if (escalated || requiresOperatorNotification(classification.intent)) {
      await notifyOperator(supabase, site, member, thread, message.body, classification, escalationReason);
    }

    return {
      success: true,
      threadId: thread.id,
      messageId: inboundRecord?.id || '',
      intent: classification.intent,
      confidence: classification.confidence,
      autoResponded: !!responseSent,
      escalated,
      escalationReason,
      responseSent,
    };
  } catch (error: any) {
    console.error('Error processing inbound message:', error);
    return {
      success: false,
      threadId: '',
      messageId: '',
      intent: 'other',
      confidence: 0,
      autoResponded: false,
      escalated: false,
      error: error.message,
    };
  }
}

async function findOrCreateThread(
  supabase: ReturnType<typeof createServerClient>,
  siteId: string,
  memberId: string | null,
  memberPhone: string
): Promise<ConversationThread> {
  // Look for an open thread within the timeout window
  const timeoutDate = new Date();
  timeoutDate.setHours(timeoutDate.getHours() - THREAD_TIMEOUT_HOURS);

  const { data: existingThread } = await supabase
    .from('conversation_threads')
    .select('*')
    .eq('site_id', siteId)
    .eq('member_phone', memberPhone)
    .in('status', ['open', 'escalated'])
    .gte('last_message_at', timeoutDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingThread) {
    return existingThread as ConversationThread;
  }

  // Create new thread
  const { data: newThread } = await supabase
    .from('conversation_threads')
    .insert({
      site_id: siteId,
      member_id: memberId,
      member_phone: memberPhone,
      status: 'open',
      message_count: 0,
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single();

  return newThread as ConversationThread;
}

async function getConversationContext(
  supabase: ReturnType<typeof createServerClient>,
  threadId: string
): Promise<string> {
  const { data: messages } = await supabase
    .from('customer_conversations')
    .select('direction, message_text')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!messages || messages.length === 0) {
    return '';
  }

  return messages
    .reverse()
    .map((m) => `${m.direction === 'inbound' ? 'Customer' : 'Business'}: ${m.message_text}`)
    .join('\n');
}

async function sendAutoResponse(
  supabase: ReturnType<typeof createServerClient>,
  site: Site & { organizations: any },
  member: Member,
  thread: ConversationThread,
  intent: IntentCategory
): Promise<{ success: boolean; messageText: string; templateName: string }> {
  const templateName = getTemplateForIntent(intent);

  // Get template
  const { data: template } = await supabase
    .from('intervention_templates')
    .select('*')
    .eq('organization_id', site.organization_id)
    .eq('name', templateName)
    .eq('active', true)
    .single();

  if (!template) {
    console.error('Template not found:', templateName);
    return { success: false, messageText: '', templateName };
  }

  // Build variables and render
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

  const messageText = renderTemplate(template.body, variables);

  // Send SMS
  if (member.phone) {
    const result = await sendSMS(member.phone, messageText);
    return {
      success: result.success,
      messageText,
      templateName,
    };
  }

  return { success: false, messageText, templateName };
}

async function notifyOperator(
  supabase: ReturnType<typeof createServerClient>,
  site: Site & { organizations: any },
  member: Member | null,
  thread: ConversationThread,
  messageText: string,
  classification: ClassificationResult,
  escalationReason?: string
): Promise<void> {
  // For now, just log - in production this would send email/SMS/push to operator
  console.log('🚨 OPERATOR NOTIFICATION');
  console.log('Site:', site.name);
  console.log('Member:', member ? `${member.first_name} ${member.last_name}` : 'Unknown');
  console.log('Message:', messageText);
  console.log('Intent:', classification.intent, `(${(classification.confidence * 100).toFixed(0)}%)`);
  console.log('Reason:', escalationReason || 'requires_attention');
  console.log('Thread ID:', thread.id);

  // TODO: Implement actual notification via:
  // - Email to operator
  // - SMS to operator
  // - Push notification
  // - Slack/Discord webhook
}

function normalizePhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // Ensure it starts with country code
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Handle operator reply to a conversation
 */
export async function sendOperatorReply(
  threadId: string,
  operatorId: string,
  messageText: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();

  // Get thread with member info
  const { data: thread } = await supabase
    .from('conversation_threads')
    .select('*, members(*), sites(*)')
    .eq('id', threadId)
    .single();

  if (!thread) {
    return { success: false, error: 'Thread not found' };
  }

  const phone = thread.member_phone || thread.members?.phone;
  if (!phone) {
    return { success: false, error: 'No phone number found' };
  }

  // Send SMS
  const result = await sendSMS(phone, messageText);

  if (result.success) {
    // Log outbound message
    await supabase.from('customer_conversations').insert({
      thread_id: threadId,
      site_id: thread.site_id,
      member_id: thread.member_id,
      direction: 'outbound',
      channel: 'sms',
      message_text: messageText,
      status: 'operator_replied',
      from_number: thread.sites?.twilio_number,
      to_number: phone,
    });

    // Update thread
    await supabase
      .from('conversation_threads')
      .update({
        status: 'open',
        operator_id: operatorId,
        message_count: (thread.message_count || 0) + 1,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', threadId);
  }

  return { success: result.success, error: result.error };
}

/**
 * Mark a conversation as resolved
 */
export async function resolveThread(
  threadId: string,
  outcome: 'saved' | 'cancelled' | 'resolved'
): Promise<void> {
  const supabase = createServerClient();

  await supabase
    .from('conversation_threads')
    .update({
      status: 'resolved',
      outcome,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', threadId);
}
