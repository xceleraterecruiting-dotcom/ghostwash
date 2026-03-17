import { NextRequest, NextResponse } from 'next/server';
import { syncAllSites, checkStaleSyncs } from '@/lib/pos/sync-pipeline';

/**
 * POS Sync Cron Job
 *
 * Runs every 15 minutes via Vercel Cron or manual trigger.
 * Performs incremental sync from all connected POS systems.
 * Checks for stale syncs and downgrades agent tier if needed.
 *
 * Schedule: *\/15 * * * * (every 15 minutes)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    console.log('[CRON:POS-SYNC] Starting POS sync...');

    // Run incremental sync for all sites
    const syncResult = await syncAllSites({
      fullSync: false,
      syncMembers: true,
      syncWashes: true,
      syncPayments: true,
      syncPlanChanges: true,
    });

    // Check for stale syncs
    const staleSites = await checkStaleSyncs();

    const summary = {
      sitesProcessed: syncResult.sitesProcessed,
      sitesSucceeded: syncResult.sitesSucceeded,
      sitesFailed: syncResult.sitesFailed,
      totalMembersProcessed: syncResult.results.reduce((sum, r) => sum + r.membersProcessed, 0),
      totalMembersCreated: syncResult.results.reduce((sum, r) => sum + r.membersCreated, 0),
      totalMembersUpdated: syncResult.results.reduce((sum, r) => sum + r.membersUpdated, 0),
      totalWashesProcessed: syncResult.results.reduce((sum, r) => sum + r.washesProcessed, 0),
      totalPaymentsProcessed: syncResult.results.reduce((sum, r) => sum + r.paymentsProcessed, 0),
      staleSitesDowngraded: staleSites.length,
      timestamp: new Date().toISOString(),
    };

    console.log('[CRON:POS-SYNC]', summary);

    return NextResponse.json({
      success: true,
      summary,
      results: syncResult.results,
      staleSites,
    });
  } catch (error: any) {
    console.error('[CRON:POS-SYNC] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
