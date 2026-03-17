const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function parseCSVLine(line) {
  const result = [];
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

function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  return null;
}

async function importMembers() {
  const siteId = '3e8a25e8-1953-4c30-a581-9c2d62d93c35';
  const csvContent = fs.readFileSync('./sample-members.csv', 'utf-8');

  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  console.log('Headers:', headers);

  const members = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx]?.trim() || ''; });

    // Parse payment status
    let paymentStatus = 'current';
    const csvPaymentStatus = (row.payment_status || '').toLowerCase();
    if (csvPaymentStatus.includes('declined') || csvPaymentStatus.includes('failed')) {
      paymentStatus = 'declined';
    }

    // Parse last wash date
    const lastWashDate = parseDate(row.last_wash_date || row.last_wash);

    // Parse total washes
    const washCountTotal = parseInt(row.total_washes || row.wash_count || '0', 10) || 0;

    // Parse join/start date
    const planStartDate = parseDate(row.join_date || row.start_date);

    const member = {
      site_id: siteId,
      pos_member_id: row.member_id || row.id || `csv-${i}`,
      first_name: row.first_name || null,
      last_name: row.last_name || null,
      email: row.email || null,
      phone: row.phone || null,
      plan_name: row.plan_name || row.plan || null,
      plan_price_cents: row.plan_price ? Math.round(parseFloat(row.plan_price) * 100) : null,
      plan_start_date: planStartDate,
      plan_status: row.status || 'active',
      payment_status: paymentStatus,
      payment_failure_count: paymentStatus === 'declined' ? 1 : 0,
      last_payment_failure: paymentStatus === 'declined' ? new Date().toISOString() : null,
      last_wash_date: lastWashDate,
      wash_count_total: washCountTotal,
    };

    members.push(member);
    console.log(`Parsed: ${member.first_name} ${member.last_name} - last_wash: ${lastWashDate}, washes: ${washCountTotal}, payment: ${paymentStatus}`);
  }

  console.log(`\nInserting ${members.length} members...`);

  const { data, error } = await supabase
    .from('members')
    .insert(members)
    .select();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Done! Inserted ${data.length} members.`);
  }
}

importMembers();
