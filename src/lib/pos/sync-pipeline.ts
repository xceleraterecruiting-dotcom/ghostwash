/**
 * POS Sync Pipeline
 *
 * Orchestrates the sync process between POS systems and GhostWash.
 * Handles member upserts, wash event logging, payment processing,
 * and triggering relevant agents on data changes.
 */

import { createServerClient } from '@/lib/db/client';
import {
  getAdapter,
  type POSCredentials,
  type POSMember,
  type POSWashEvent,
  type POSPaymentEvent,
  type POSPlanChangeEvent,
} from './adapter-interface';
import { calculateChurnScore } from '@/lib/agents/membership/churn-scorer';

// Import adapters to register them
import './washify-adapter';
import './csv-adapter';

export interface SyncOptions {
  fullSync?: boolean;
  syncMembers?: boolean;
  syncWashes?: boolean;
  syncPayments?: boolean;
  syncPlanChanges?: boolean;
}

export interface SyncSiteResult {
  siteId: string;
  siteName: string;
  success: boolean;
  membersProcessed: number;
  membersCreated: number;
  membersUpdated: number;
  washesProcessed: number;
  paymentsProcessed: number;
  planChangesProcessed: number;
  errors: string[];
  durationMs: number;
}

/**
 * Get credentials from site record
 */
function getCredentialsFromSite(site: any): POSCredentials {
  return {
    apiKey: site.pos_api_key || '',
    apiSecret: site.pos_api_secret || '',
    companyId: site.pos_company_id || '',
    locationId: site.pos_location_id || '',
  };
}

/**
 * Upsert a member from POS data
 */
async function upsertMember(
  supabase: any,
  siteId: string,
  posMember: POSMember
): Promise<{ created: boolean; memberId: string }> {
  // Check if member exists by external ID or email/phone
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('site_id', siteId)
    .or(
      `external_id.eq.${posMember.externalId},email.eq.${posMember.email || 'NULL'},phone.eq.${posMember.phone || 'NULL'}`
    )
    .limit(1)
    .single();

  const memberData = {
    site_id: siteId,
    external_id: posMember.externalId,
    first_name: posMember.firstName,
    last_name: posMember.lastName,
    email: posMember.email,
    phone: posMember.phone,
    plan_name: posMember.planName,
    plan_price_cents: posMember.planPriceCents,
    plan_status: posMember.status,
    plan_start_date: posMember.joinDate.toISOString(),
    card_last_four: posMember.cardLastFour,
    vehicle_plate: posMember.vehiclePlate,
    vehicle_make: posMember.vehicleMake,
    vehicle_color: posMember.vehicleColor,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    // Update existing member
    await supabase.from('members').update(memberData).eq('id', existing.id);

    return { created: false, memberId: existing.id };
  } else {
    // Create new member
    const { data: newMember } = await supabase
      .from('members')
      .insert(memberData)
      .select('id')
      .single();

    return { created: true, memberId: newMember?.id };
  }
}

/**
 * Insert wash event and update member stats
 */
async function processWashEvent(
  supabase: any,
  siteId: string,
  wash: POSWashEvent
): Promise<boolean> {
  // Find member by external ID
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('site_id', siteId)
    .eq('external_id', wash.memberExternalId)
    .single();

  if (!member) {
    console.log(`[SYNC] Member not found for wash: ${wash.memberExternalId}`);
    return false;
  }

  // Upsert wash event
  await supabase.from('wash_events').upsert(
    {
      site_id: siteId,
      member_id: member.id,
      external_id: wash.externalId,
      wash_type: wash.washType,
      washed_at: wash.washedAt.toISOString(),
      lane: wash.lane,
      duration_seconds: wash.durationSeconds,
      raw_data: wash.rawData,
    },
    { onConflict: 'site_id,external_id' }
  );

  // Update member's last wash date and counts
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: washCount30d } = await supabase
    .from('wash_events')
    .select('id', { count: 'exact' })
    .eq('member_id', member.id)
    .gte('washed_at', thirtyDaysAgo.toISOString());

  const { count: washCountTotal } = await supabase
    .from('wash_events')
    .select('id', { count: 'exact' })
    .eq('member_id', member.id);

  await supabase
    .from('members')
    .update({
      last_wash_date: wash.washedAt.toISOString(),
      wash_count_30d: washCount30d || 0,
      wash_count_total: washCountTotal || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', member.id);

  return true;
}

/**
 * Process payment event and update member status
 */
async function processPaymentEvent(
  supabase: any,
  siteId: string,
  payment: POSPaymentEvent
): Promise<boolean> {
  // Find member by external ID
  const { data: member } = await supabase
    .from('members')
    .select('id, payment_failure_count')
    .eq('site_id', siteId)
    .eq('external_id', payment.memberExternalId)
    .single();

  if (!member) {
    console.log(`[SYNC] Member not found for payment: ${payment.memberExternalId}`);
    return false;
  }

  // Insert payment event
  await supabase.from('payment_events').upsert(
    {
      site_id: siteId,
      member_id: member.id,
      external_id: payment.externalId,
      event_type: payment.eventType,
      amount_cents: payment.amountCents,
      occurred_at: payment.occurredAt.toISOString(),
      failure_reason: payment.failureReason,
      card_last_four: payment.cardLastFour,
      raw_data: payment.rawData,
    },
    { onConflict: 'site_id,external_id' }
  );

  // Update member payment status
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (payment.eventType === 'charge_failed') {
    updateData.payment_status = 'failed';
    updateData.payment_failure_count = (member.payment_failure_count || 0) + 1;
    updateData.last_payment_failure_date = payment.occurredAt.toISOString();
    updateData.payment_failure_reason = payment.failureReason;
  } else if (payment.eventType === 'charge_success') {
    updateData.payment_status = 'current';
    // Don't reset failure count - keep for history
  }

  if (payment.cardLastFour) {
    updateData.card_last_four = payment.cardLastFour;
  }

  await supabase.from('members').update(updateData).eq('id', member.id);

  return true;
}

/**
 * Process plan change event
 */
async function processPlanChangeEvent(
  supabase: any,
  siteId: string,
  change: POSPlanChangeEvent
): Promise<boolean> {
  // Find member by external ID
  const { data: member } = await supabase
    .from('members')
    .select('id, plan_name, plan_status')
    .eq('site_id', siteId)
    .eq('external_id', change.memberExternalId)
    .single();

  if (!member) {
    console.log(`[SYNC] Member not found for plan change: ${change.memberExternalId}`);
    return false;
  }

  // Insert plan change event
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
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  switch (change.changeType) {
    case 'cancel':
      updateData.plan_status = 'cancelled';
      updateData.plan_end_date = change.occurredAt.toISOString();
      break;
    case 'reactivate':
      updateData.plan_status = 'active';
      break;
    case 'upgrade':
    case 'downgrade':
      if (change.toPlan) {
        updateData.plan_name = change.toPlan;
      }
      break;
  }

  await supabase.from('members').update(updateData).eq('id', member.id);

  return true;
}

/**
 * Update churn scores for all active members at a site
 */
async function updateChurnScores(supabase: any, siteId: string): Promise<number> {
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('site_id', siteId)
    .eq('plan_status', 'active');

  if (!members || members.length === 0) return 0;

  let updated = 0;

  for (const member of members) {
    const daysSinceLastWash = member.last_wash_date
      ? Math.floor((Date.now() - new Date(member.last_wash_date).getTime()) / (24 * 60 * 60 * 1000))
      : null;

    const planAgeDays = member.plan_start_date
      ? Math.floor(
          (Date.now() - new Date(member.plan_start_date).getTime()) / (24 * 60 * 60 * 1000)
        )
      : 0;

    const { score } = calculateChurnScore({
      wash_count_30d: member.wash_count_30d || 0,
      wash_count_60d: member.wash_count_30d || 0,
      avg_wash_frequency_days: member.avg_wash_frequency_days,
      days_since_last_wash: daysSinceLastWash,
      payment_failure_count: member.payment_failure_count || 0,
      plan_age_days: planAgeDays,
      month: new Date().getMonth() + 1,
    });

    await supabase
      .from('members')
      .update({
        churn_score: score,
        churn_score_updated_at: new Date().toISOString(),
      })
      .eq('id', member.id);

    updated++;
  }

  return updated;
}

/**
 * Log sync result to pos_sync_log table
 */
async function logSyncResult(
  supabase: any,
  siteId: string,
  syncType: 'full' | 'incremental',
  result: SyncSiteResult,
  startedAt: Date
): Promise<void> {
  await supabase.from('pos_sync_log').insert({
    site_id: siteId,
    sync_type: syncType,
    records_synced:
      result.membersProcessed + result.washesProcessed + result.paymentsProcessed,
    members_synced: result.membersCreated + result.membersUpdated,
    washes_synced: result.washesProcessed,
    payments_synced: result.paymentsProcessed,
    status: result.success ? 'success' : result.errors.length > 0 ? 'partial' : 'failed',
    error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: result.durationMs,
  });
}

/**
 * Run sync for a single site
 */
export async function syncSite(
  siteId: string,
  options: SyncOptions = {}
): Promise<SyncSiteResult> {
  const startTime = Date.now();
  const startedAt = new Date();
  const supabase = createServerClient();
  const errors: string[] = [];

  const {
    fullSync = false,
    syncMembers = true,
    syncWashes = true,
    syncPayments = true,
    syncPlanChanges = true,
  } = options;

  let membersProcessed = 0;
  let membersCreated = 0;
  let membersUpdated = 0;
  let washesProcessed = 0;
  let paymentsProcessed = 0;
  let planChangesProcessed = 0;

  try {
    // Get site details
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*, organizations(name)')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return {
        siteId,
        siteName: 'Unknown',
        success: false,
        membersProcessed: 0,
        membersCreated: 0,
        membersUpdated: 0,
        washesProcessed: 0,
        paymentsProcessed: 0,
        planChangesProcessed: 0,
        errors: ['Site not found'],
        durationMs: Date.now() - startTime,
      };
    }

    // Skip if no POS configured or CSV-only
    if (!site.pos_type || site.pos_type === 'csv_import') {
      return {
        siteId,
        siteName: site.name,
        success: true,
        membersProcessed: 0,
        membersCreated: 0,
        membersUpdated: 0,
        washesProcessed: 0,
        paymentsProcessed: 0,
        planChangesProcessed: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    // Get adapter
    const adapter = getAdapter(site.pos_type);
    if (!adapter) {
      errors.push(`No adapter found for POS type: ${site.pos_type}`);
      return {
        siteId,
        siteName: site.name,
        success: false,
        membersProcessed: 0,
        membersCreated: 0,
        membersUpdated: 0,
        washesProcessed: 0,
        paymentsProcessed: 0,
        planChangesProcessed: 0,
        errors,
        durationMs: Date.now() - startTime,
      };
    }

    // Update sync status
    await supabase
      .from('sites')
      .update({ pos_sync_status: 'syncing' })
      .eq('id', siteId);

    const credentials = getCredentialsFromSite(site);
    const sinceDate = fullSync || !site.pos_last_sync
      ? new Date(0)
      : new Date(site.pos_last_sync);

    // Sync members
    if (syncMembers) {
      try {
        const { members, result } = await adapter.syncMembers(siteId, credentials);
        membersProcessed = result.recordsProcessed;

        for (const member of members) {
          try {
            const { created } = await upsertMember(supabase, siteId, member);
            if (created) {
              membersCreated++;
            } else {
              membersUpdated++;
            }
          } catch (err: any) {
            errors.push(`Member ${member.externalId}: ${err.message}`);
          }
        }

        if (result.errors.length > 0) {
          errors.push(...result.errors.map((e) => `Member ${e.id}: ${e.error}`));
        }
      } catch (err: any) {
        errors.push(`Member sync failed: ${err.message}`);
      }
    }

    // Sync washes
    if (syncWashes) {
      try {
        const { washes, result } = await adapter.syncWashes(siteId, credentials, sinceDate);
        washesProcessed = result.recordsProcessed;

        for (const wash of washes) {
          try {
            await processWashEvent(supabase, siteId, wash);
          } catch (err: any) {
            errors.push(`Wash ${wash.externalId}: ${err.message}`);
          }
        }
      } catch (err: any) {
        errors.push(`Wash sync failed: ${err.message}`);
      }
    }

    // Sync payments
    if (syncPayments) {
      try {
        const { payments, result } = await adapter.syncPaymentEvents(
          siteId,
          credentials,
          sinceDate
        );
        paymentsProcessed = result.recordsProcessed;

        for (const payment of payments) {
          try {
            await processPaymentEvent(supabase, siteId, payment);
          } catch (err: any) {
            errors.push(`Payment ${payment.externalId}: ${err.message}`);
          }
        }
      } catch (err: any) {
        errors.push(`Payment sync failed: ${err.message}`);
      }
    }

    // Sync plan changes
    if (syncPlanChanges) {
      try {
        const { changes, result } = await adapter.syncPlanChanges(
          siteId,
          credentials,
          sinceDate
        );
        planChangesProcessed = result.recordsProcessed;

        for (const change of changes) {
          try {
            await processPlanChangeEvent(supabase, siteId, change);
          } catch (err: any) {
            errors.push(`Plan change ${change.externalId}: ${err.message}`);
          }
        }
      } catch (err: any) {
        errors.push(`Plan change sync failed: ${err.message}`);
      }
    }

    // Update churn scores
    await updateChurnScores(supabase, siteId);

    // Update site sync status
    const syncStatus = errors.length === 0 ? 'connected' : 'failed';
    await supabase
      .from('sites')
      .update({
        pos_last_sync: new Date().toISOString(),
        pos_sync_status: syncStatus,
      })
      .eq('id', siteId);

    const result: SyncSiteResult = {
      siteId,
      siteName: site.name,
      success: errors.length === 0,
      membersProcessed,
      membersCreated,
      membersUpdated,
      washesProcessed,
      paymentsProcessed,
      planChangesProcessed,
      errors,
      durationMs: Date.now() - startTime,
    };

    // Log sync result
    await logSyncResult(supabase, siteId, fullSync ? 'full' : 'incremental', result, startedAt);

    return result;
  } catch (error: any) {
    console.error(`[SYNC] Site ${siteId} sync failed:`, error);

    await supabase
      .from('sites')
      .update({ pos_sync_status: 'failed' })
      .eq('id', siteId);

    return {
      siteId,
      siteName: 'Unknown',
      success: false,
      membersProcessed,
      membersCreated,
      membersUpdated,
      washesProcessed,
      paymentsProcessed,
      planChangesProcessed,
      errors: [error.message],
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Run sync for all sites with POS integrations
 */
export async function syncAllSites(options: SyncOptions = {}): Promise<{
  sitesProcessed: number;
  sitesSucceeded: number;
  sitesFailed: number;
  results: SyncSiteResult[];
}> {
  const supabase = createServerClient();

  // Get all sites with POS integration (not CSV)
  const { data: sites } = await supabase
    .from('sites')
    .select('id')
    .neq('pos_type', 'csv_import')
    .not('pos_api_key', 'is', null);

  if (!sites || sites.length === 0) {
    return {
      sitesProcessed: 0,
      sitesSucceeded: 0,
      sitesFailed: 0,
      results: [],
    };
  }

  const results: SyncSiteResult[] = [];

  for (const site of sites) {
    const result = await syncSite(site.id, options);
    results.push(result);
  }

  return {
    sitesProcessed: results.length,
    sitesSucceeded: results.filter((r) => r.success).length,
    sitesFailed: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Check for stale syncs and downgrade agent tier
 */
export async function checkStaleSyncs(): Promise<string[]> {
  const supabase = createServerClient();
  const staleThresholdMinutes = 30;
  const staleThreshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);

  // Operating hours check (7am - 9pm)
  const hour = new Date().getHours();
  const isOperatingHours = hour >= 7 && hour < 21;

  if (!isOperatingHours) {
    return [];
  }

  // Find sites with stale syncs
  const { data: staleSites } = await supabase
    .from('sites')
    .select('id, name, pos_last_sync')
    .neq('pos_type', 'csv_import')
    .not('pos_api_key', 'is', null)
    .eq('pos_sync_status', 'connected')
    .lt('pos_last_sync', staleThreshold.toISOString());

  if (!staleSites || staleSites.length === 0) {
    return [];
  }

  const staleSiteIds: string[] = [];

  for (const site of staleSites) {
    // Mark as stale
    await supabase
      .from('sites')
      .update({ pos_sync_status: 'stale' })
      .eq('id', site.id);

    // Downgrade tier assignments to 3 (recommend only)
    await supabase
      .from('tier_assignments')
      .update({ tier: 3 })
      .eq('site_id', site.id);

    staleSiteIds.push(site.id);
    console.log(`[SYNC] Site ${site.name} marked as stale - downgraded to Tier 3`);
  }

  return staleSiteIds;
}

/**
 * Test POS connection for a site
 */
export async function testPOSConnection(
  posType: string,
  credentials: POSCredentials
): Promise<{ success: boolean; message: string; details?: any }> {
  const adapter = getAdapter(posType);

  if (!adapter) {
    return {
      success: false,
      message: `Unknown POS type: ${posType}`,
    };
  }

  return adapter.testConnection(credentials);
}
