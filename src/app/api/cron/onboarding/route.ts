import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { runOnboardingDrips } from '@/lib/agents/membership/intervention-engine';

/**
 * Onboarding Drip Cron Job
 *
 * Runs daily at 10am via Vercel Cron or manual trigger.
 * Sends onboarding sequence messages to new members.
 *
 * Schedule: 0 10 * * * (daily at 10am)
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
    const supabase = createServerClient();

    const { data: sites } = await supabase
      .from('sites')
      .select('id, name')
      .eq('status', 'active');

    if (!sites) {
      return NextResponse.json({ error: 'No sites found' }, { status: 500 });
    }

    const results = [];

    for (const site of sites) {
      const result = await runOnboardingDrips(site.id);
      results.push({
        site_id: site.id,
        site_name: site.name,
        ...result,
      });
    }

    const summary = {
      sites_processed: results.length,
      total_members_processed: results.reduce((sum, r) => sum + r.membersProcessed, 0),
      total_messages_sent: results.reduce((sum, r) => sum + r.messagesSent, 0),
      timestamp: new Date().toISOString(),
    };

    console.log('[CRON:ONBOARDING]', summary);

    return NextResponse.json({
      success: true,
      summary,
      results,
    });
  } catch (error: any) {
    console.error('[CRON:ONBOARDING] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
