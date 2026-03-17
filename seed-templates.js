const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const defaultTemplates = [
  {
    template_type: 'churn_winback',
    channel: 'sms',
    name: 'Win-back SMS',
    body: "Hey {{first_name}}, we miss you at {{site_name}}! Come back this week and get {{offer_details}} on your {{plan_name}} membership.",
    offer_type: 'discount_10pct',
    priority: 10,
  },
  {
    template_type: 'churn_winback',
    channel: 'email',
    name: 'Win-back Email',
    subject: "We saved your spot, {{first_name}}",
    body: "Hi {{first_name}},\n\nWe noticed it's been a while since your last wash. Your {{plan_name}} membership is still active — and we'd love to see you back.\n\nAs a thank you for being a member, here's {{offer_details}}.\n\nSee you soon!",
    offer_type: 'discount_10pct',
    priority: 10,
  },
  {
    template_type: 'cc_decline',
    channel: 'sms',
    name: 'CC Recovery SMS',
    body: "Hi {{first_name}}, we had trouble processing your {{plan_name}} payment. Please update your card to keep your membership active: {{update_link}}",
    priority: 10,
  },
  {
    template_type: 'onboarding_day1',
    channel: 'sms',
    name: 'Welcome Day 1',
    body: "Welcome to {{site_name}}, {{first_name}}! Your {{plan_name}} membership is active. Pro tip: members who wash 2+ times in their first month stay 3x longer. Come see us!",
    priority: 10,
  },
  {
    template_type: 'onboarding_day7',
    channel: 'sms',
    name: 'Welcome Day 7',
    body: "Hey {{first_name}}, how's the first week? You've got unlimited washes — use them! {{site_name}} is open 7am-9pm daily.",
    priority: 10,
  },
  {
    template_type: 'onboarding_day30',
    channel: 'sms',
    name: 'Welcome Day 30',
    body: "{{first_name}}, you've been a member for a month! You've saved {{savings_amount}} compared to retail washes. Keep it up!",
    priority: 10,
  },
];

async function seedTemplates() {
  console.log('Fetching organizations...');

  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name');

  if (orgsError) {
    console.error('Error fetching organizations:', orgsError);
    process.exit(1);
  }

  console.log(`Found ${orgs.length} organization(s)`);

  for (const org of orgs) {
    console.log(`\nSeeding templates for: ${org.name}`);

    // Check existing templates
    const { data: existing } = await supabase
      .from('intervention_templates')
      .select('name')
      .eq('organization_id', org.id);

    const existingNames = new Set(existing?.map(t => t.name) || []);

    // Filter out templates that already exist
    const templatesToInsert = defaultTemplates
      .filter(t => !existingNames.has(t.name))
      .map(t => ({
        organization_id: org.id,
        ...t,
      }));

    if (templatesToInsert.length === 0) {
      console.log('  All templates already exist, skipping');
      continue;
    }

    const { error: insertError } = await supabase
      .from('intervention_templates')
      .insert(templatesToInsert);

    if (insertError) {
      console.error(`  Error inserting templates:`, insertError);
    } else {
      console.log(`  Inserted ${templatesToInsert.length} template(s)`);
    }
  }

  console.log('\nDone!');
}

seedTemplates();
