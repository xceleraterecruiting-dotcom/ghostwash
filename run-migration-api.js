const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'public' },
    auth: { persistSession: false }
  }
);

async function runMigration() {
  console.log('Running migration-004 indexes and templates...\n');

  // Run indexes one by one using raw SQL via postgres function
  const indexStatements = [
    'CREATE INDEX IF NOT EXISTS idx_threads_site ON conversation_threads(site_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_threads_member ON conversation_threads(member_id)',
    'CREATE INDEX IF NOT EXISTS idx_threads_status ON conversation_threads(site_id, status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_threads_phone ON conversation_threads(member_phone)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_thread ON customer_conversations(thread_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_site ON customer_conversations(site_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_intent ON customer_conversations(site_id, classified_intent)',
  ];

  console.log('Creating indexes...');
  for (const idx of indexStatements) {
    console.log('  ○', idx.substring(30, 80) + '...');
  }
  console.log('  (indexes need SQL Editor - skipping)\n');

  // Add columns to sites
  console.log('Adding twilio columns to sites...');
  console.log('  (columns need SQL Editor - skipping)\n');

  // Insert templates - this we CAN do via the API
  console.log('Inserting response templates...\n');

  // Get organization IDs
  const { data: orgs } = await supabase.from('organizations').select('id');

  if (!orgs || orgs.length === 0) {
    console.log('No organizations found!');
    return;
  }

  console.log(`Found ${orgs.length} organization(s)\n`);

  const templates = [
    {
      name: 'Save Offer Response',
      body: "Hey {{first_name}}, sorry to hear you're thinking about leaving! Before you go — how about 50% off your {{plan_name}} for the next 2 months? You've already gotten {{wash_count}} washes worth {{savings_amount}} in retail value. Want to keep that going? Reply YES to accept!"
    },
    {
      name: 'Confirm Cancel Response',
      body: "We understand, {{first_name}}. Your {{plan_name}} membership will remain active through your current billing period. We'd love to have you back anytime. Reply JOIN to reactivate."
    },
    {
      name: 'Billing Info Response',
      body: "Hi {{first_name}}, your current plan is {{plan_name}} at {{plan_price}}/mo. Need to make changes? Reply UPDATE or call us at {{site_phone}}."
    },
    {
      name: 'Payment Update Response',
      body: "Hi {{first_name}}, here's your secure link to update your payment method: {{payment_update_link}}. This keeps your {{plan_name}} membership active."
    },
    {
      name: 'Hours Location Response',
      body: "{{site_name}} is open 7am-8pm daily. Come see us!"
    },
    {
      name: 'Complaint Response',
      body: "{{first_name}}, we're really sorry about your experience. Our manager has been notified and will follow up with you within 24 hours. We want to make this right."
    },
    {
      name: 'Compliment Response',
      body: "Thanks so much, {{first_name}}! That means a lot to our team at {{site_name}}. We appreciate you being a member!"
    },
    {
      name: 'Membership Question Response',
      body: "Great question! We have several unlimited wash plans starting at $29.99/mo. Want to upgrade? Reply UPGRADE or visit our website to see all options."
    },
    {
      name: 'Fallback Response',
      body: "Thanks for reaching out, {{first_name}}. Let me connect you with our team. Someone will get back to you within 24 hours."
    }
  ];

  for (const org of orgs) {
    console.log(`Organization: ${org.id}`);

    for (const tmpl of templates) {
      // Check if exists
      const { data: existing } = await supabase
        .from('intervention_templates')
        .select('id')
        .eq('organization_id', org.id)
        .eq('name', tmpl.name)
        .single();

      if (existing) {
        console.log(`  ○ ${tmpl.name} (exists)`);
        continue;
      }

      // Insert
      const { error } = await supabase
        .from('intervention_templates')
        .insert({
          organization_id: org.id,
          name: tmpl.name,
          template_type: 'inbound_response',
          channel: 'sms',
          subject: null,
          body: tmpl.body,
          priority: 100,
          active: true
        });

      if (error) {
        console.log(`  ✗ ${tmpl.name} - ${error.message}`);
      } else {
        console.log(`  ✓ ${tmpl.name}`);
      }
    }
  }

  console.log('\n========================================');
  console.log('Templates inserted via API!');
  console.log('========================================\n');

  console.log('Still need to run in Supabase SQL Editor:');
  console.log('1. CREATE INDEX statements (7 indexes)');
  console.log('2. ALTER TABLE sites ADD COLUMN statements (2 columns)\n');

  console.log('SQL for remaining items:\n');
  console.log(`-- Indexes
CREATE INDEX IF NOT EXISTS idx_threads_site ON conversation_threads(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_member ON conversation_threads(member_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON conversation_threads(site_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_phone ON conversation_threads(member_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON customer_conversations(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_site ON customer_conversations(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_intent ON customer_conversations(site_id, classified_intent);

-- Site columns
ALTER TABLE sites ADD COLUMN IF NOT EXISTS twilio_number VARCHAR(20);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS twilio_number_sid VARCHAR(50);`);
}

runMigration().catch(console.error);
