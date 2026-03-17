const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verify() {
  console.log('Verifying migration status...\n');

  // Check tables
  const { error: threadsErr } = await supabase.from('conversation_threads').select('id').limit(1);
  const { error: convosErr } = await supabase.from('customer_conversations').select('id').limit(1);

  console.log('Tables:');
  console.log(threadsErr ? '  ✗ conversation_threads' : '  ✓ conversation_threads');
  console.log(convosErr ? '  ✗ customer_conversations' : '  ✓ customer_conversations');

  // Check templates
  const { data: templates } = await supabase
    .from('intervention_templates')
    .select('name')
    .eq('template_type', 'inbound_response');

  console.log('\nInbound Response Templates:');
  if (templates && templates.length > 0) {
    templates.forEach(t => console.log(`  ✓ ${t.name}`));
  } else {
    console.log('  ✗ No templates found');
  }

  // Check sites columns (by querying)
  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('twilio_number')
    .limit(1);

  console.log('\nSite columns:');
  if (siteErr && siteErr.message.includes('twilio_number')) {
    console.log('  ✗ twilio_number column missing');
  } else {
    console.log('  ✓ twilio_number column exists');
  }

  console.log('\n========================================');
  console.log('REMAINING: Run in Supabase SQL Editor');
  console.log('========================================\n');

  console.log(`-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_threads_site ON conversation_threads(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_member ON conversation_threads(member_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON conversation_threads(site_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_phone ON conversation_threads(member_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON customer_conversations(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_site ON customer_conversations(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_intent ON customer_conversations(site_id, classified_intent);

-- Add Twilio columns to sites table
ALTER TABLE sites ADD COLUMN IF NOT EXISTS twilio_number VARCHAR(20);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS twilio_number_sid VARCHAR(50);`);

  console.log('\n========================================');
  console.log('Steps:');
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to SQL Editor');
  console.log('4. Paste the SQL above');
  console.log('5. Click Run');
  console.log('========================================\n');
}

verify();
