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

    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'churn_score';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    // Build query
    let query = supabase
      .from('members')
      .select('*', { count: 'exact' })
      .eq('site_id', siteId);

    // Apply search filter
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('plan_status', status);
    }

    // Apply sorting
    const ascending = sortOrder === 'asc';
    query = query.order(sortBy, { ascending, nullsFirst: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: members, error, count } = await query;

    if (error) {
      console.error('Members fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get site info
    const { data: site } = await supabase
      .from('sites')
      .select('*, organizations(*)')
      .eq('id', siteId)
      .single();

    // Get summary stats
    const { data: stats } = await supabase
      .from('members')
      .select('plan_status, churn_score')
      .eq('site_id', siteId);

    const summary = {
      total: stats?.length || 0,
      active: stats?.filter((m) => m.plan_status === 'active').length || 0,
      atRisk: stats?.filter((m) => m.plan_status === 'active' && m.churn_score >= 60).length || 0,
      paused: stats?.filter((m) => m.plan_status === 'paused').length || 0,
      cancelled: stats?.filter((m) => m.plan_status === 'cancelled').length || 0,
    };

    return NextResponse.json({
      members,
      site,
      summary,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Members API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
