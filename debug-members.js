const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugMembers() {
  const { data: members, error } = await supabase
    .from('members')
    .select('first_name, last_name, last_wash_date, wash_count_total, payment_status, payment_failure_count, churn_score')
    .eq('site_id', '3e8a25e8-1953-4c30-a581-9c2d62d93c35')
    .order('churn_score', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Members sorted by churn score (highest first):\n');
  console.log('Name                    | Last Wash  | Days | Washes | Payment  | Score');
  console.log('-'.repeat(80));

  members.forEach(m => {
    const name = `${m.first_name} ${m.last_name}`.padEnd(23);
    const lastWash = m.last_wash_date ? m.last_wash_date.split('T')[0] : 'null';
    const daysSince = m.last_wash_date
      ? Math.floor((Date.now() - new Date(m.last_wash_date).getTime()) / (24 * 60 * 60 * 1000))
      : '-';
    const washes = String(m.wash_count_total || 0).padStart(6);
    const payment = m.payment_status.padEnd(8);
    const score = m.churn_score !== null ? Math.round(m.churn_score) : 'null';
    console.log(`${name} | ${lastWash} | ${String(daysSince).padStart(4)} | ${washes} | ${payment} | ${score}`);
  });
}

debugMembers();
