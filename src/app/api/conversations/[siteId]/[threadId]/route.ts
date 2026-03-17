/**
 * Thread Detail API
 *
 * GET /api/conversations/[siteId]/[threadId] - Get thread with all messages
 * POST - Send operator reply
 * PATCH - Update thread status/outcome
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { sendOperatorReply, resolveThread } from '@/lib/conversations/conversation-service';
import { withSiteAuth } from '@/lib/auth/api-guard';

export async function GET(
  request: NextRequest,
  { params }: { params: { siteId: string; threadId: string } }
) {
  try {
    const { siteId, threadId } = params;

    // Verify user has access to this site
    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const supabase = createServerClient();

    // Get thread
    const { data: thread, error: threadError } = await supabase
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
          plan_name,
          plan_price_cents,
          plan_status,
          wash_count_30d,
          wash_count_total,
          churn_score,
          tags,
          notes
        )
      `
      )
      .eq('id', threadId)
      .eq('site_id', siteId)
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Get all messages
    const { data: messages } = await supabase
      .from('customer_conversations')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      thread,
      messages: messages || [],
    });
  } catch (error: any) {
    console.error('Thread detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { siteId: string; threadId: string } }
) {
  try {
    const { siteId, threadId } = params;

    // Verify user has access to this site
    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { message, operatorId } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = await sendOperatorReply(
      threadId,
      operatorId || 'operator',
      message
    );

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Send reply error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { siteId: string; threadId: string } }
) {
  try {
    const { siteId, threadId } = params;

    // Verify user has access to this site
    const authResult = await withSiteAuth(siteId);
    if (authResult instanceof NextResponse) return authResult;

    const body = await request.json();
    const { status, outcome } = body;

    const supabase = createServerClient();

    const updateData: Record<string, any> = {};

    if (status) {
      updateData.status = status;
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
      }
    }

    if (outcome) {
      updateData.outcome = outcome;
    }

    const { error } = await supabase
      .from('conversation_threads')
      .update(updateData)
      .eq('id', threadId)
      .eq('site_id', siteId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update thread error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
