/**
 * CSV Import Adapter
 *
 * Fallback POS adapter for operators who export member data
 * from their POS dashboard as CSV. This gets GhostWash running
 * immediately without formal API access.
 */

import type { POSAdapter, POSMember, POSTransaction, POSPlan } from './interface';

export class CSVImportAdapter implements POSAdapter {
  // CSV import doesn't poll - data comes via upload
  async fetchMembers(_siteId: string, _since?: Date): Promise<POSMember[]> {
    // Members are imported via the /api/pos/upload endpoint
    // This method returns empty since CSV is push-based, not pull-based
    return [];
  }

  async fetchTransactions(_siteId: string, _since?: Date): Promise<POSTransaction[]> {
    return [];
  }

  async fetchPlans(_siteId: string): Promise<POSPlan[]> {
    return [];
  }

  async getMemberById(_posMemberId: string): Promise<POSMember | null> {
    return null;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    return { success: true }; // CSV always "works"
  }
}

// Extended member type with wash data
export interface ParsedMember extends POSMember {
  last_wash_date: string | null;
  wash_count_total: number;
}

/**
 * Parse a CSV string of member data into ParsedMember objects.
 * Supports headers: member_id, first_name, last_name, email, phone, plan_name,
 * plan_price, start_date/join_date, status, payment_status, last_wash_date, total_washes
 */
export function parseMembers(csvContent: string): ParsedMember[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  // Normalize headers: lowercase, replace spaces with underscores
  const headers = lines[0].split(',').map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_')
  );
  const members: ParsedMember[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle CSV values that may contain commas in quoted strings
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx]?.trim() || ''; });

    // Parse payment status from CSV - look for 'declined', 'failed', 'past_due'
    let paymentStatus = 'current';
    const csvPaymentStatus = (row.payment_status || row.card_status || '').toLowerCase();
    if (csvPaymentStatus.includes('declined') || csvPaymentStatus.includes('failed')) {
      paymentStatus = 'declined';
    } else if (csvPaymentStatus.includes('retry') || csvPaymentStatus.includes('past_due')) {
      paymentStatus = 'retry_pending';
    }

    // Parse last wash date - try multiple column names
    const lastWashRaw = row.last_wash_date || row.last_wash || row.last_visit || row.last_service || '';
    const lastWashDate = parseDate(lastWashRaw);

    // Parse total washes
    const totalWashesRaw = row.total_washes || row.wash_count || row.visits || row.washes || '0';
    const washCountTotal = parseInt(totalWashesRaw, 10) || 0;

    // Parse join/start date
    const joinDateRaw = row.join_date || row.start_date || row.plan_start_date || row.signup_date || '';
    const planStartDate = parseDate(joinDateRaw);

    members.push({
      pos_member_id: row.member_id || row.id || `csv-${i}`,
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      email: row.email || null,
      phone: row.phone || null,
      plan_name: row.plan_name || row.plan || null,
      plan_price_cents: row.plan_price ? Math.round(parseFloat(row.plan_price) * 100) : null,
      plan_start_date: planStartDate,
      plan_status: (row.status || row.plan_status || 'active') as any,
      payment_status: paymentStatus as any,
      last_payment_date: null,
      last_payment_failure: paymentStatus === 'declined' ? new Date().toISOString() : null,
      payment_failure_count: paymentStatus === 'declined' ? 1 : 0,
      vehicles: row.plate || row.license_plate ? [{ plate: row.plate || row.license_plate }] : [],
      last_wash_date: lastWashDate,
      wash_count_total: washCountTotal,
    });
  }

  return members;
}

/**
 * Parse a CSV line handling quoted values with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Parse various date formats into ISO string
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Try ISO format first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }

  // Try MM/DD/YYYY format
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    date = new Date(parseInt(mdyMatch[3]), parseInt(mdyMatch[1]) - 1, parseInt(mdyMatch[2]));
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Try YYYY-MM-DD format
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    date = new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]));
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}
