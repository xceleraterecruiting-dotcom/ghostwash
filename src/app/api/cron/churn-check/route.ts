import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { runChurnCheck } from '@/lib/agents/membership/intervention-engine';

// Churn Check Cron Job
//
// Runs every 6 hours via Vercel Cron or manual trigger.
// Updates churn scores for all active members and triggers
// interventions for those above the threshold.
//
// Schedule: 0 X/6 * * * (every 6 hours)
export async function GET(request: NextRequest) {
  // Verify cron secret for security (in production)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // In development, allow without auth
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const supabase = createServerClient();

    // Get all active sites
    const { data: sites, error } = await supabase
      .from('sites')
      .select('id, name')
      .eq('status', 'active');

    if (error || !sites) {
      return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
    }

    const results = [];

    for (const site of sites) {
      const result = await runChurnCheck(site.id);
      results.push({
        site_id: site.id,
        site_name: site.name,
        ...result,
      });
    }

    const summary = {
      sites_processed: results.length,
      total_members_checked: results.reduce((sum, r) => sum + r.membersChecked, 0),
      total_interventions: results.reduce((sum, r) => sum + r.interventionsSent, 0),
      timestamp: new Date().toISOString(),
    };

    console.log('[CRON:CHURN-CHECK]', summary);

    return NextResponse.json({
      success: true,
      summary,
      results,
    });
  } catch (error: any) {
    console.error('[CRON:CHURN-CHECK] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
