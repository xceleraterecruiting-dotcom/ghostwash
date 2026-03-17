import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
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

    const agent = searchParams.get('agent') || 'all';
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    // Build query - join with members to get names
    let query = supabase
      .from('agent_actions')
      .select(`
        *,
        members:target_id (
          first_name,
          last_name,
          email
        )
      `, { count: 'exact' })
      .eq('site_id', siteId);

    if (agent !== 'all') {
      query = query.eq('agent', agent);
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: actions, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from('agent_actions')
      .select('status, action_type')
      .eq('site_id', siteId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const summary = {
      total_7d: stats?.length || 0,
      executed: stats?.filter((a) => a.status === 'executed').length || 0,
      pending: stats?.filter((a) => a.status === 'pending_approval').length || 0,
      failed: stats?.filter((a) => a.status === 'failed').length || 0,
      by_type: {} as Record<string, number>,
    };

    stats?.forEach((a) => {
      summary.by_type[a.action_type] = (summary.by_type[a.action_type] || 0) + 1;
    });

    return NextResponse.json({
      actions,
      summary,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
