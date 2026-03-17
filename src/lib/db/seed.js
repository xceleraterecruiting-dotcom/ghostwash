const { Client } = require('pg');
const path = require('path');

async function seedTemplates() {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') });

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    // Get all organizations
    const { rows: orgs } = await client.query('SELECT id FROM organizations');

    if (orgs.length === 0) {
      console.log('No organizations found. Create an org first via /setup');
      return;
    }

    console.log(`Seeding templates for ${orgs.length} organization(s)...\n`);

    const templates = [
      // Churn Win-back SMS
      {
        template_type: 'churn_winback',
        channel: 'sms',
        name: 'Win-back: Free Upgrade Offer',
        subject: null,
        body: "Hey {{first_name}}! We miss seeing you at {{site_name}}. Here's a free upgrade to our Ultimate wash on your next visit. Just show this text! 🚗✨",
        offer_type: 'free_upgrade',
        offer_value: 'Ultimate wash upgrade',
        priority: 10,
      },
      {
        template_type: 'churn_winback',
        channel: 'sms',
        name: 'Win-back: Value Reminder',
        subject: null,
        body: "Hi {{first_name}}, your {{plan_name}} membership has saved you {{savings_amount}} so far! We'd love to see you back at {{site_name}}. Your unlimited washes are waiting.",
        offer_type: 'none',
        offer_value: null,
        priority: 5,
      },
      // Churn Win-back Email
      {
        template_type: 'churn_winback',
        channel: 'email',
        name: 'Win-back Email: We Miss You',
        subject: "{{first_name}}, we miss you at {{site_name}}!",
        body: `Hi {{first_name}},

We noticed it's been a while since your last wash. We miss you!

As a thank you for being a {{plan_name}} member, here's a special offer: your next wash is on us — upgraded to our Ultimate package.

Just stop by anytime and mention this email.

Your membership has already saved you {{savings_amount}}. Let's keep that savings growing!

See you soon,
The {{site_name}} Team`,
        offer_type: 'free_upgrade',
        offer_value: 'Ultimate wash upgrade',
        priority: 8,
      },
      // CC Decline SMS
      {
        template_type: 'cc_decline',
        channel: 'sms',
        name: 'Payment Update Request',
        subject: null,
        body: "Hi {{first_name}}, we had trouble processing your {{plan_name}} payment. Update your card here to keep your unlimited washes active: {{payment_update_link}}",
        offer_type: 'none',
        offer_value: null,
        priority: 10,
      },
      // Onboarding Day 0
      {
        template_type: 'onboarding_day0',
        channel: 'sms',
        name: 'Welcome Message',
        subject: null,
        body: "Welcome to {{site_name}}, {{first_name}}! 🎉 Your {{plan_name}} membership is now active. Come by anytime for unlimited washes. We can't wait to see you!",
        offer_type: 'none',
        offer_value: null,
        priority: 10,
      },
      // Onboarding Day 3
      {
        template_type: 'onboarding_day3',
        channel: 'sms',
        name: 'Usage Prompt',
        subject: null,
        body: "Hey {{first_name}}! Have you used your unlimited membership yet? Your {{plan_name}} washes are waiting at {{site_name}}. Stop by anytime!",
        offer_type: 'none',
        offer_value: null,
        priority: 10,
      },
      // Onboarding Day 7
      {
        template_type: 'onboarding_day7',
        channel: 'sms',
        name: 'Value Reinforcement',
        subject: null,
        body: "{{first_name}}, you've already washed {{wash_count}} times! That's {{savings_amount}} saved vs retail. Your {{plan_name}} is paying for itself. 🚗✨",
        offer_type: 'none',
        offer_value: null,
        priority: 10,
      },
      // Onboarding Day 14
      {
        template_type: 'onboarding_day14',
        channel: 'sms',
        name: 'Referral Invite',
        subject: null,
        body: "{{first_name}}, loving your unlimited washes? Share the love! Tell a friend about {{site_name}} and you'll both get a free Ultimate upgrade on your next visit.",
        offer_type: 'referral_bonus',
        offer_value: 'Free upgrade for both',
        priority: 10,
      },
      // Onboarding Day 30
      {
        template_type: 'onboarding_day30',
        channel: 'sms',
        name: '30-Day Milestone',
        subject: null,
        body: "🎉 {{first_name}}, you're a 30-day member! You've washed {{wash_count}} times and saved {{savings_amount}}. Thanks for being part of the {{site_name}} family!",
        offer_type: 'free_upgrade',
        offer_value: 'One free Ultimate upgrade',
        priority: 10,
      },
      // Review Request
      {
        template_type: 'review_request',
        channel: 'sms',
        name: 'Google Review Request',
        subject: null,
        body: "Hi {{first_name}}! Enjoying your {{plan_name}} membership? We'd love a quick Google review. It really helps! Thanks for being awesome. 🌟",
        offer_type: 'none',
        offer_value: null,
        priority: 10,
      },
    ];

    for (const org of orgs) {
      for (const template of templates) {
        // Check if template already exists
        const { rows: existing } = await client.query(
          `SELECT id FROM intervention_templates
           WHERE organization_id = $1 AND template_type = $2 AND channel = $3 AND name = $4`,
          [org.id, template.template_type, template.channel, template.name]
        );

        if (existing.length === 0) {
          await client.query(
            `INSERT INTO intervention_templates
             (organization_id, template_type, channel, name, subject, body, offer_type, offer_value, priority)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              org.id,
              template.template_type,
              template.channel,
              template.name,
              template.subject,
              template.body,
              template.offer_type,
              template.offer_value,
              template.priority,
            ]
          );
          console.log(`  ✓ ${template.template_type} - ${template.name}`);
        } else {
          console.log(`  ○ ${template.template_type} - ${template.name} (exists)`);
        }
      }
    }

    console.log('\n✓ Seeding complete!');
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedTemplates();
