import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getUser } from '@/lib/auth';
import { provisionNumber, getAreaCodeFromState, formatPhoneNumber } from '@/lib/comms/twilio-provisioning';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orgName, ownerName, ownerEmail, ownerPhone, siteName, siteAddress, city, state, posType } = body;

    if (!orgName || !ownerEmail || !siteName) {
      return NextResponse.json(
        { error: 'Missing required fields: orgName, ownerEmail, siteName' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Create organization with user_id
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        owner_name: ownerName || null,
        owner_email: ownerEmail,
        owner_phone: ownerPhone || null,
        pos_type: posType || 'csv_import',
        user_id: user.id,
      })
      .select()
      .single();

    if (orgError) {
      // Check if it's a duplicate email error
      if (orgError.code === '23505') {
        return NextResponse.json(
          { error: 'An organization with this email already exists' },
          { status: 409 }
        );
      }
      console.error('Org creation error:', orgError);
      return NextResponse.json(
        { error: 'Failed to create organization', details: orgError.message },
        { status: 500 }
      );
    }

    // Create org_member entry for the owner
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Org member creation error:', memberError);
      // Non-fatal - org was created, just log the error
    }

    // Create site
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .insert({
        organization_id: org.id,
        name: siteName,
        address: siteAddress || null,
        city: city || null,
        state: state || null,
      })
      .select()
      .single();

    if (siteError) {
      console.error('Site creation error:', siteError);
      // Rollback org creation
      await supabase.from('organizations').delete().eq('id', org.id);
      return NextResponse.json(
        { error: 'Failed to create site', details: siteError.message },
        { status: 500 }
      );
    }

    // Provision Twilio phone number for the site
    let twilioNumber: string | null = null;
    let twilioNumberFormatted: string | null = null;
    let twilioError: string | null = null;

    try {
      const areaCode = getAreaCodeFromState(state || 'SC');
      const provisionResult = await provisionNumber(
        areaCode,
        site.id,
        `GhostWash - ${siteName}`
      );

      if (provisionResult.success && provisionResult.phoneNumber) {
        twilioNumber = provisionResult.phoneNumber;
        twilioNumberFormatted = formatPhoneNumber(provisionResult.phoneNumber);

        // Save to sites table
        await supabase
          .from('sites')
          .update({
            twilio_number: provisionResult.phoneNumber,
            twilio_number_sid: provisionResult.phoneNumberSid,
          })
          .eq('id', site.id);

        console.log(`[SETUP] Provisioned Twilio number ${twilioNumber} for site ${site.id}`);
      } else {
        twilioError = provisionResult.error || 'Failed to provision number';
        console.error('[SETUP] Twilio provisioning failed:', twilioError);
      }
    } catch (err: any) {
      twilioError = err.message;
      console.error('[SETUP] Twilio provisioning error:', err);
    }

    // Create default tier assignments for Phase 1 decisions
    const defaultTiers = [
      { decision_type: 'churn_winback', tier: 1 },
      { decision_type: 'cc_retry', tier: 1 },
      { decision_type: 'onboarding', tier: 1 },
    ];

    await supabase.from('tier_assignments').insert(
      defaultTiers.map((t) => ({
        organization_id: org.id,
        site_id: site.id,
        ...t,
      }))
    );

    // Create default guardrails
    const defaultGuardrails = [
      { category: 'comms', rule_key: 'max_msgs_per_member_week', rule_value: { value: 3 } },
      { category: 'comms', rule_key: 'min_days_between_contact', rule_value: { value: 7 } },
    ];

    await supabase.from('guardrails').insert(
      defaultGuardrails.map((g) => ({
        organization_id: org.id,
        ...g,
      }))
    );

    // Create default templates
    const defaultTemplates = [
      {
        template_type: 'churn_winback',
        channel: 'sms',
        name: 'Win-back SMS',
        body: "Hey {{first_name}}, we miss you at {{site_name}}! Come back this week and get 20% off your next month. Your {{plan_name}} membership is waiting.",
        offer_type: 'discount_20pct',
        priority: 10,
      },
      {
        template_type: 'churn_winback',
        channel: 'email',
        name: 'Win-back Email',
        subject: "We saved your spot, {{first_name}}",
        body: "Hi {{first_name}},\n\nWe noticed it's been a while since your last wash. Your {{plan_name}} membership at {{site_name}} is still active.\n\nAs a thank you, here's 20% off your next month.\n\nSee you soon!",
        offer_type: 'discount_20pct',
        priority: 10,
      },
      {
        template_type: 'cc_recovery',
        channel: 'sms',
        name: 'Payment Recovery SMS',
        body: "Hi {{first_name}}, we had trouble processing your {{plan_name}} payment. Update your card here to keep your membership active: {{update_link}}",
        priority: 10,
      },
      {
        template_type: 'welcome',
        channel: 'email',
        name: 'Welcome Day 1',
        subject: "Welcome to {{site_name}}, {{first_name}}!",
        body: "Your {{plan_name}} membership is active!\n\nPro tip: members who wash 2+ times in their first month stay 3x longer. Come see us!",
        priority: 10,
      },
      {
        template_type: 'welcome',
        channel: 'sms',
        name: 'Welcome Day 7',
        body: "Hey {{first_name}}, how's the first week? You've got unlimited washes at {{site_name}} — use them! Open 7am-9pm daily.",
        priority: 5,
      },
      {
        template_type: 'welcome',
        channel: 'email',
        name: 'Welcome Day 30',
        subject: "One month in, {{first_name}}!",
        body: "You've been a {{site_name}} member for a month! You've completed {{wash_count}} washes. Keep the streak going!",
        priority: 1,
      },
    ];

    await supabase.from('intervention_templates').insert(
      defaultTemplates.map((t) => ({
        organization_id: org.id,
        ...t,
      }))
    );

    return NextResponse.json({
      success: true,
      organization: org,
      site: {
        ...site,
        twilio_number: twilioNumber,
        twilio_number_formatted: twilioNumberFormatted,
      },
      twilioProvisioned: !!twilioNumber,
      twilioError: twilioError,
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed', details: error.message },
      { status: 500 }
    );
  }
}

// Get existing orgs and sites
export async function GET() {
  try {
    const supabase = createServerClient();

    const { data: orgs, error } = await supabase
      .from('organizations')
      .select(`
        *,
        sites (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ organizations: orgs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
