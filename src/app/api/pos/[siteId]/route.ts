import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { withSiteAuth } from '@/lib/auth/api-guard';
import { syncSite, testPOSConnection, getAdapter } from '@/lib/pos';

/**
 * POS Integration API
 *
 * GET - Get POS connection status and sync logs
 * POST - Test connection or trigger manual sync
 * PUT - Update POS credentials
 */

// Get POS status and logs
export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    const { siteId } = params;

    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const supabase = createServerClient();

    // Get site POS config
    const { data: site } = await supabase
      .from('sites')
      .select('id, name, pos_type, pos_company_id, pos_location_id, pos_last_sync, pos_sync_status')
      .eq('id', siteId)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Get recent sync logs
    const { data: syncLogs } = await supabase
      .from('pos_sync_log')
      .select('*')
      .eq('site_id', siteId)
      .order('started_at', { ascending: false })
      .limit(10);

    // Get sync stats
    const { data: stats } = await supabase
      .from('pos_sync_log')
      .select('status, records_synced')
      .eq('site_id', siteId)
      .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const last24h = {
      totalSyncs: stats?.length || 0,
      successfulSyncs: stats?.filter((s) => s.status === 'success').length || 0,
      failedSyncs: stats?.filter((s) => s.status === 'failed').length || 0,
      recordsSynced: stats?.reduce((sum, s) => sum + (s.records_synced || 0), 0) || 0,
    };

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name,
        posType: site.pos_type,
        companyId: site.pos_company_id,
        locationId: site.pos_location_id,
        lastSync: site.pos_last_sync,
        syncStatus: site.pos_sync_status,
      },
      syncLogs: syncLogs || [],
      stats: last24h,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Test connection or trigger sync
export async function POST(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    const { siteId } = params;

    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { action, credentials } = body;

    const supabase = createServerClient();

    if (action === 'test') {
      // Test connection with provided credentials
      const { posType, apiKey, apiSecret, companyId, locationId } = credentials || {};

      if (!posType || !apiKey) {
        return NextResponse.json(
          { error: 'Missing required fields: posType, apiKey' },
          { status: 400 }
        );
      }

      const result = await testPOSConnection(posType, {
        apiKey,
        apiSecret,
        companyId,
        locationId,
      });

      return NextResponse.json(result);
    }

    if (action === 'sync') {
      // Trigger manual sync
      const { fullSync = false } = body;

      const result = await syncSite(siteId, {
        fullSync,
        syncMembers: true,
        syncWashes: true,
        syncPayments: true,
        syncPlanChanges: true,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update POS credentials
export async function PUT(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    const { siteId } = params;

    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { posType, apiKey, apiSecret, companyId, locationId } = body;

    if (!posType) {
      return NextResponse.json({ error: 'posType is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // If setting up a new POS (not CSV), test connection first
    if (posType !== 'csv_import' && apiKey) {
      const testResult = await testPOSConnection(posType, {
        apiKey,
        apiSecret,
        companyId,
        locationId,
      });

      if (!testResult.success) {
        return NextResponse.json(
          { error: 'Connection test failed', details: testResult.message },
          { status: 400 }
        );
      }
    }

    // Update site POS config
    const updateData: Record<string, any> = {
      pos_type: posType,
      updated_at: new Date().toISOString(),
    };

    if (posType === 'csv_import') {
      // Clear POS credentials for CSV
      updateData.pos_api_key = null;
      updateData.pos_api_secret = null;
      updateData.pos_company_id = null;
      updateData.pos_location_id = null;
      updateData.pos_sync_status = 'not_configured';
    } else {
      updateData.pos_api_key = apiKey || null;
      updateData.pos_api_secret = apiSecret || null;
      updateData.pos_company_id = companyId || null;
      updateData.pos_location_id = locationId || null;
      updateData.pos_sync_status = apiKey ? 'connected' : 'not_configured';
    }

    const { error } = await supabase.from('sites').update(updateData).eq('id', siteId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If connected, trigger initial sync
    if (updateData.pos_sync_status === 'connected') {
      // Run in background - don't wait
      syncSite(siteId, { fullSync: true }).catch((err) => {
        console.error('[POS] Initial sync failed:', err);
      });
    }

    return NextResponse.json({
      success: true,
      posType,
      syncStatus: updateData.pos_sync_status,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
