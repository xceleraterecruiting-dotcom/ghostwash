const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const templates = [
  {
    template_type: 'churn_winback',
    channel: 'sms',
    name: 'Win-back SMS',
    subject: null,
    body: "Hey {{first_name}}, we miss you at {{site_name}}! Come back this week and get 20% off your next month. Your {{plan_name}} membership is waiting.",
    offer_type: 'discount_20pct',
    priority: 10,
  },
  {
    template_type: 'churn_winback',
    channel: 'email',
    name: 'Win-back Email',
    subject: "We saved your spot, {{first_name}}",
    body: "Hi {{first_name}},\n\nWe noticed it's been a while since your last wash. Your {{plan_name}} membership at {{site_name}} is still active.\n\nAs a thank you, here's 20% off your next month.\n\nSee you soon!",
    offer_type: 'discount_20pct',
    priority: 10,
  },
  {
    template_type: 'cc_recovery',
    channel: 'sms',
    name: 'Payment Recovery SMS',
    subject: null,
    body: "Hi {{first_name}}, we had trouble processing your {{plan_name}} payment. Update your card here to keep your membership active: {{update_link}}",
    offer_type: null,
    priority: 10,
  },
  {
    template_type: 'welcome',
    channel: 'email',
    name: 'Welcome Day 1',
    subject: "Welcome to {{site_name}}, {{first_name}}!",
    body: "Your {{plan_name}} membership is active!\n\nPro tip: members who wash 2+ times in their first month stay 3x longer. Come see us!",
    offer_type: null,
    priority: 10,
  },
  {
    template_type: 'welcome',
    channel: 'sms',
    name: 'Welcome Day 7',
    subject: null,
    body: "Hey {{first_name}}, how's the first week? You've got unlimited washes at {{site_name}} — use them! Open 7am-9pm daily.",
    offer_type: null,
    priority: 5,
  },
  {
    template_type: 'welcome',
    channel: 'email',
    name: 'Welcome Day 30',
    subject: "One month in, {{first_name}}!",
    body: "You've been a {{site_name}} member for a month! You've completed {{wash_count}} washes. Keep the streak going!",
    offer_type: null,
    priority: 1,
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

  console.log(`Found ${orgs.length} organization(s)\n`);

  for (const org of orgs) {
    console.log(`Seeding templates for: ${org.name}`);

    // Delete existing templates for this org
    const { error: deleteError } = await supabase
      .from('intervention_templates')
      .delete()
      .eq('organization_id', org.id);

    if (deleteError) {
      console.error(`  Error deleting existing templates:`, deleteError);
      continue;
    }

    // Insert new templates
    const templatesToInsert = templates.map(t => ({
      organization_id: org.id,
      ...t,
      active: true,
    }));

    const { error: insertError } = await supabase
      .from('intervention_templates')
      .insert(templatesToInsert);

    if (insertError) {
      console.error(`  Error inserting templates:`, insertError);
    } else {
      console.log(`  ✓ Inserted ${templates.length} templates`);
    }
  }

  console.log('\nDone!');
}

seedTemplates();
