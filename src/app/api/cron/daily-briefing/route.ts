import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import {
  generateBriefing,
  saveBriefing,
  sendBriefing,
} from '@/lib/briefing/generator';

/**
 * Daily Briefing Cron Job
 *
 * Runs daily at 6am via Vercel Cron.
 * Generates and sends morning briefings to all operators.
 *
 * Schedule: 0 6 * * * (daily at 6am)
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

    // Get all active sites with their org info
    const { data: sites } = await supabase
      .from('sites')
      .select('id, name, organizations(owner_email, owner_phone)')
      .eq('status', 'active');

    if (!sites || sites.length === 0) {
      return NextResponse.json({ message: 'No active sites' });
    }

    const results = [];

    for (const site of sites) {
      try {
        // Generate briefing
        const briefing = await generateBriefing(site.id);

        // Save to database
        await saveBriefing(briefing);

        // Send to operator
        const org = site.organizations as any;
        const sendResult = await sendBriefing(
          briefing,
          org.owner_email,
          org.owner_phone
        );

        results.push({
          site_id: site.id,
          site_name: site.name,
          success: true,
          ...sendResult,
        });
      } catch (error: any) {
        results.push({
          site_id: site.id,
          site_name: site.name,
          success: false,
          error: error.message,
        });
      }
    }

    console.log('[CRON:DAILY-BRIEFING]', {
      sites_processed: results.length,
      successful: results.filter((r) => r.success).length,
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('[CRON:DAILY-BRIEFING] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
