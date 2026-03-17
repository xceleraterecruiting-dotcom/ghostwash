import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { generateBriefing, saveBriefing } from '@/lib/briefing/generator';
import { withSiteAuth } from '@/lib/auth/api-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    const { siteId } = params;

    // Verify user has access to this site
    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    const supabase = createServerClient();

    if (date) {
      // Get specific briefing
      const { data: briefing } = await supabase
        .from('daily_briefings')
        .select('*')
        .eq('site_id', siteId)
        .eq('briefing_date', date)
        .single();

      return NextResponse.json({ briefing });
    }

    // Get recent briefings
    const { data: briefings } = await supabase
      .from('daily_briefings')
      .select('*')
      .eq('site_id', siteId)
      .order('briefing_date', { ascending: false })
      .limit(30);

    return NextResponse.json({ briefings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Generate briefing on demand
export async function POST(
  request: NextRequest,
  { params }: { params: { siteId: string } }
) {
  try {
    const { siteId } = params;

    // Verify user has access to this site
    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const briefing = await generateBriefing(siteId);
    await saveBriefing(briefing);

    return NextResponse.json({ success: true, briefing });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
