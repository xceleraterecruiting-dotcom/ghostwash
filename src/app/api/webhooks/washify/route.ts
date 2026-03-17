import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getAdapter, type POSMember, type POSWashEvent, type POSPaymentEvent, type POSPlanChangeEvent } from '@/lib/pos/adapter-interface';

// Import to register adapter
import '@/lib/pos/washify-adapter';

/**
 * Washify Webhook Endpoint
 *
 * Receives real-time events from Washify POS system.
 * Processes member updates, wash events, payments, and plan changes.
 *
 * Security: Validates webhook signature using site's API secret
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const signature = request.headers.get('x-washify-signature') || '';
    const siteId = request.headers.get('x-site-id') || payload.siteId || payload.site_id;

    if (!siteId) {
      console.error('[WASHIFY-WEBHOOK] No site ID in request');
      return NextResponse.json({ error: 'Missing site ID' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get site and verify it's using Washify
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id, pos_type, pos_api_secret')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      console.error('[WASHIFY-WEBHOOK] Site not found:', siteId);
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    if (site.pos_type !== 'washify') {
      console.error('[WASHIFY-WEBHOOK] Site is not configured for Washify:', siteId);
      return NextResponse.json({ error: 'Site not configured for Washify' }, { status: 400 });
    }

    // Validate webhook signature
    const adapter = getAdapter('washify');
    if (adapter?.validateWebhookSignature && site.pos_api_secret) {
      const isValid = adapter.validateWebhookSignature(
        JSON.stringify(payload),
        signature,
        site.pos_api_secret
      );

      if (!isValid && process.env.NODE_ENV === 'production') {
        console.error('[WASHIFY-WEBHOOK] Invalid signature for site:', siteId);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Process webhook
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const result = await adapter?.handleWebhook(siteId, payload, headers);

    if (!result?.processed) {
      console.log('[WASHIFY-WEBHOOK] Event not processed:', result?.eventType);
      return NextResponse.json({ received: true, processed: false });
    }

    // Process the data based on type
    const data = result.data;

    if (isPosMember(data)) {
      await upsertMemberFromWebhook(supabase, siteId, data);
    } else if (isPosWashEvent(data)) {
      await processWashFromWebhook(supabase, siteId, data);
    } else if (isPosPaymentEvent(data)) {
      await processPaymentFromWebhook(supabase, siteId, data);
    } else if (isPosPlanChangeEvent(data)) {
      await processPlanChangeFromWebhook(supabase, siteId, data);
    }

    console.log('[WASHIFY-WEBHOOK] Processed event:', result.eventType, 'for site:', siteId);

    return NextResponse.json({
      received: true,
      processed: true,
      eventType: result.eventType,
    });
  } catch (error: any) {
    console.error('[WASHIFY-WEBHOOK] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Type guards
function isPosMember(data: any): data is POSMember {
  return data && 'externalId' in data && 'firstName' in data;
}

function isPosWashEvent(data: any): data is POSWashEvent {
  return data && 'washedAt' in data && 'memberExternalId' in data;
}

function isPosPaymentEvent(data: any): data is POSPaymentEvent {
  return data && 'eventType' in data && 'amountCents' in data;
}

function isPosPlanChangeEvent(data: any): data is POSPlanChangeEvent {
  return data && 'changeType' in data && 'memberExternalId' in data;
}

// Process functions
async function upsertMemberFromWebhook(supabase: any, siteId: string, member: POSMember) {
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('site_id', siteId)
    .eq('external_id', member.externalId)
    .single();

  const memberData = {
    site_id: siteId,
    external_id: member.externalId,
    first_name: member.firstName,
    last_name: member.lastName,
    email: member.email,
    phone: member.phone,
    plan_name: member.planName,
    plan_price_cents: member.planPriceCents,
    plan_status: member.status,
    plan_start_date: member.joinDate.toISOString(),
    card_last_four: member.cardLastFour,
    vehicle_plate: member.vehiclePlate,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    await supabase.from('members').update(memberData).eq('id', existing.id);
  } else {
    await supabase.from('members').insert(memberData);
  }
}

async function processWashFromWebhook(supabase: any, siteId: string, wash: POSWashEvent) {
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('site_id', siteId)
    .eq('external_id', wash.memberExternalId)
    .single();

  if (!member) return;

  await supabase.from('wash_events').upsert(
    {
      site_id: siteId,
      member_id: member.id,
      external_id: wash.externalId,
      wash_type: wash.washType,
      washed_at: wash.washedAt.toISOString(),
      lane: wash.lane,
      raw_data: wash.rawData,
    },
    { onConflict: 'site_id,external_id' }
  );

  // Update member last wash
  await supabase
    .from('members')
    .update({
      last_wash_date: wash.washedAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', member.id);
}

async function processPaymentFromWebhook(supabase: any, siteId: string, payment: POSPaymentEvent) {
  const { data: member } = await supabase
    .from('members')
    .select('id, payment_failure_count')
    .eq('site_id', siteId)
    .eq('external_id', payment.memberExternalId)
    .single();

  if (!member) return;

  await supabase.from('payment_events').upsert(
    {
      site_id: siteId,
      member_id: member.id,
      external_id: payment.externalId,
      event_type: payment.eventType,
      amount_cents: payment.amountCents,
      occurred_at: payment.occurredAt.toISOString(),
      failure_reason: payment.failureReason,
      raw_data: payment.rawData,
    },
    { onConflict: 'site_id,external_id' }
  );

  // Update member payment status
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

  if (payment.eventType === 'charge_failed') {
    updateData.payment_status = 'failed';
    updateData.payment_failure_count = (member.payment_failure_count || 0) + 1;
    updateData.last_payment_failure_date = payment.occurredAt.toISOString();
    updateData.payment_failure_reason = payment.failureReason;
  } else if (payment.eventType === 'charge_success') {
    updateData.payment_status = 'current';
  }

  await supabase.from('members').update(updateData).eq('id', member.id);
}

async function processPlanChangeFromWebhook(
  supabase: any,
  siteId: string,
  change: POSPlanChangeEvent
) {
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('site_id', siteId)
    .eq('external_id', change.memberExternalId)
    .single();

  if (!member) return;

  await supabase.from('plan_change_events').upsert(
    {
      site_id: siteId,
      member_id: member.id,
      external_id: change.externalId,
      change_type: change.changeType,
      from_plan: change.fromPlan,
      to_plan: change.toPlan,
      reason: change.reason,
      occurred_at: change.occurredAt.toISOString(),
      raw_data: change.rawData,
    },
    { onConflict: 'site_id,external_id' }
  );

  // Update member status
  const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

  if (change.changeType === 'cancel') {
    updateData.plan_status = 'cancelled';
    updateData.plan_end_date = change.occurredAt.toISOString();
  } else if (change.changeType === 'reactivate') {
    updateData.plan_status = 'active';
  } else if (change.toPlan) {
    updateData.plan_name = change.toPlan;
  }

  await supabase.from('members').update(updateData).eq('id', member.id);
}
