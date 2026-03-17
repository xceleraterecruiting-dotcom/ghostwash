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

    // Upsert members
    const membersToInsert = parsedMembers.map((m) => ({
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
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('members')
      .upsert(membersToInsert, {
        onConflict: 'site_id,pos_member_id',
        ignoreDuplicates: false,
      })
      .select();

    // Update sync log
    if (syncLog) {
      await supabase
        .from('pos_sync_log')
        .update({
          status: insertError ? 'failed' : 'success',
          records_synced: inserted?.length || 0,
          errors: insertError ? { message: insertError.message } : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to import members', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imported: inserted?.length || 0,
      message: `Successfully imported ${inserted?.length || 0} members`,
    });
  } catch (error: any) {
    console.error('CSV upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process CSV', details: error.message },
      { status: 500 }
    );
  }
}
