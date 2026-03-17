import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { calculateChurnScore } from '@/lib/agents/membership/churn-scorer';
import { withSiteAuth } from '@/lib/auth/api-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string; memberId: string } }
) {
  try {
    const { siteId, memberId } = params;

    // Verify user has access to this site
    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const supabase = createServerClient();

    // Get member details
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', memberId)
      .eq('site_id', siteId)
      .single();

    if (error || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Get recent washes
    const { data: washes } = await supabase
      .from('washes')
      .select('*')
      .eq('member_id', memberId)
      .order('washed_at', { ascending: false })
      .limit(20);

    // Get agent actions for this member
    const { data: actions } = await supabase
      .from('agent_actions')
      .select('*')
      .eq('target_id', memberId)
      .eq('target_type', 'member')
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate churn score breakdown
    const daysSinceLastWash = member.last_wash_date
      ? Math.floor(
          (Date.now() - new Date(member.last_wash_date).getTime()) / (24 * 60 * 60 * 1000)
        )
      : null;

    const planAgeDays = member.plan_start_date
      ? Math.floor(
          (Date.now() - new Date(member.plan_start_date).getTime()) / (24 * 60 * 60 * 1000)
        )
      : 0;

    const churnAnalysis = calculateChurnScore({
      wash_count_30d: member.wash_count_30d || 0,
      wash_count_60d: member.wash_count_30d || 0, // Approximation for now
      avg_wash_frequency_days: member.avg_wash_frequency_days,
      days_since_last_wash: daysSinceLastWash,
      payment_failure_count: member.payment_failure_count || 0,
      plan_age_days: planAgeDays,
      month: new Date().getMonth() + 1,
    });

    return NextResponse.json({
      member,
      washes: washes || [],
      actions: actions || [],
      churnAnalysis,
    });
  } catch (error: any) {
    console.error('Member detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { siteId: string; memberId: string } }
) {
  try {
    const { siteId, memberId } = params;

    // Verify user has access to this site
    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const supabase = createServerClient();

    // Build update object with only allowed fields
    const updateData: Record<string, any> = {};

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    if (body.tags !== undefined) {
      updateData.tags = body.tags;
    }

    if (body.do_not_contact !== undefined) {
      updateData.do_not_contact = body.do_not_contact;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: member, error } = await supabase
      .from('members')
      .update(updateData)
      .eq('id', memberId)
      .eq('site_id', siteId)
      .select()
      .single();

    if (error) {
      console.error('Member update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, member });
  } catch (error: any) {
    console.error('Member PATCH error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
