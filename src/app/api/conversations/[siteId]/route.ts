/**
 * Conversations API
 *
 * GET /api/conversations/[siteId] - List conversation threads
 * Query params:
 *   - status: open | escalated | resolved
 *   - intent: filter by intent
 *   - page: pagination
 */

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

    const searchParams = request.nextUrl.searchParams;

    const status = searchParams.get('status');
    const intent = searchParams.get('intent');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = createServerClient();

    // Build query
    let query = supabase
      .from('conversation_threads')
      .select(
        `
        *,
        members (
          id,
          first_name,
          last_name,
          phone,
          email,
          plan_name
        )
      `,
        { count: 'exact' }
      )
      .eq('site_id', siteId)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (intent) {
      query = query.eq('intent', intent);
    }

    const { data: threads, count, error } = await query;

    if (error) {
      console.error('Conversations query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get last message for each thread
    const threadIds = threads?.map((t) => t.id) || [];
    const { data: lastMessages } = await supabase
      .from('customer_conversations')
      .select('thread_id, message_text, direction, created_at')
      .in('thread_id', threadIds)
      .order('created_at', { ascending: false });

    // Group last messages by thread
    const lastMessageByThread: Record<string, any> = {};
    for (const msg of lastMessages || []) {
      if (!lastMessageByThread[msg.thread_id]) {
        lastMessageByThread[msg.thread_id] = msg;
      }
    }

    // Get summary stats
    const { data: stats } = await supabase
      .from('conversation_threads')
      .select('status, outcome')
      .eq('site_id', siteId);

    const summary = {
      total: stats?.length || 0,
      open: stats?.filter((s) => s.status === 'open').length || 0,
      escalated: stats?.filter((s) => s.status === 'escalated').length || 0,
      resolved: stats?.filter((s) => s.status === 'resolved').length || 0,
      saved: stats?.filter((s) => s.outcome === 'saved').length || 0,
      cancelled: stats?.filter((s) => s.outcome === 'cancelled').length || 0,
    };

    // Combine threads with last messages
    const threadsWithMessages = threads?.map((thread) => ({
      ...thread,
      last_message: lastMessageByThread[thread.id] || null,
    }));

    return NextResponse.json({
      threads: threadsWithMessages || [],
      summary,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Conversations API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
