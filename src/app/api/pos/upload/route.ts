import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { parseMembers } from '@/lib/pos/csv-import';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const siteId = formData.get('siteId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!siteId) {
      return NextResponse.json({ error: 'No siteId provided' }, { status: 400 });
    }

    const csvContent = await file.text();
    const parsedMembers = parseMembers(csvContent);

    if (parsedMembers.length === 0) {
      return NextResponse.json({ error: 'No valid members found in CSV' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Start sync log
    const { data: syncLog, error: syncError } = await supabase
      .from('pos_sync_log')
      .insert({
        site_id: siteId,
        sync_type: 'csv_import',
        status: 'running',
      })
      .select()
      .single();

    if (syncError) {
      console.error('Sync log error:', syncError);
    }

    // Get existing members by email for deduplication
    const emails = parsedMembers
      .map((m) => m.email)
      .filter((e): e is string => !!e);

    const { data: existingMembers } = await supabase
      .from('members')
      .select('id, email')
      .eq('site_id', siteId)
      .in('email', emails);

    const existingByEmail = new Map(
      (existingMembers || []).map((m) => [m.email?.toLowerCase(), m.id])
    );

    let newCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    // Process each member - update if email exists, insert if new
    for (const m of parsedMembers) {
      const memberData = {
        site_id: siteId,
        pos_member_id: m.pos_member_id,
        first_name: m.first_name,
        last_name: m.last_name,
        email: m.email,
        phone: m.phone,
        plan_name: m.plan_name,
        plan_price_cents: m.plan_price_cents,
        plan_start_date: m.plan_start_date,
        plan_status: m.plan_status,
        payment_status: m.payment_status,
        last_payment_failure: m.last_payment_failure,
        payment_failure_count: m.payment_failure_count,
        vehicles: m.vehicles,
        last_wash_date: m.last_wash_date,
        wash_count_total: m.wash_count_total,
      };

      const existingId = m.email ? existingByEmail.get(m.email.toLowerCase()) : null;

      if (existingId) {
        // Update existing member
        const { error } = await supabase
          .from('members')
          .update({
            ...memberData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId);

        if (error) {
          errors.push(`Failed to update ${m.email}: ${error.message}`);
        } else {
          updatedCount++;
        }
      } else {
        // Insert new member
        const { error } = await supabase
          .from('members')
          .insert(memberData);

        if (error) {
          errors.push(`Failed to insert ${m.email}: ${error.message}`);
        } else {
          newCount++;
        }
      }
    }

    const totalProcessed = newCount + updatedCount;

    // Update sync log
    if (syncLog) {
      await supabase
        .from('pos_sync_log')
        .update({
          status: errors.length > 0 ? 'partial' : 'success',
          records_synced: totalProcessed,
          members_synced: totalProcessed,
          errors: errors.length > 0 ? { messages: errors } : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    return NextResponse.json({
      success: true,
      imported: totalProcessed,
      new: newCount,
      updated: updatedCount,
      message: `Imported ${totalProcessed} members: ${newCount} new, ${updatedCount} updated`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('CSV upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process CSV', details: error.message },
      { status: 500 }
    );
  }
}
