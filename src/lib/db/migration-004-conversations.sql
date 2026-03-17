-- Migration 004: Inbound Message Flow / Conversations
-- Run this in Supabase SQL Editor

-- Conversation threads (one per conversation session)
CREATE TABLE IF NOT EXISTS conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  member_id UUID REFERENCES members(id),
  member_phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'escalated')),
  intent VARCHAR(50),
  outcome VARCHAR(20) CHECK (outcome IN ('saved', 'cancelled', 'resolved', 'pending', NULL)),
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  escalation_reason TEXT,
  operator_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Individual messages within threads
CREATE TABLE IF NOT EXISTS customer_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES conversation_threads(id),
  site_id UUID NOT NULL REFERENCES sites(id),
  member_id UUID REFERENCES members(id),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('sms', 'voice', 'email')),
  message_text TEXT NOT NULL,
  classified_intent VARCHAR(50),
  confidence_score DECIMAL(3,2),
  template_used VARCHAR(100),
  status VARCHAR(20) DEFAULT 'handled' CHECK (status IN ('handled', 'escalated', 'pending', 'operator_replied')),
  twilio_sid VARCHAR(50),
  from_number VARCHAR(20),
  to_number VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for threads
CREATE INDEX IF NOT EXISTS idx_threads_site ON conversation_threads(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_member ON conversation_threads(member_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON conversation_threads(site_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_phone ON conversation_threads(member_phone);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON customer_conversations(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_site ON customer_conversations(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_intent ON customer_conversations(site_id, classified_intent);

-- Add twilio_number to sites for inbound routing
ALTER TABLE sites ADD COLUMN IF NOT EXISTS twilio_number VARCHAR(20);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS twilio_number_sid VARCHAR(50);

-- Add response templates for inbound intents
INSERT INTO intervention_templates (organization_id, name, template_type, channel, subject, body, priority, active)
SELECT
  o.id,
  'Save Offer Response',
  'inbound_response',
  'sms',
  NULL,
  'Hey {{first_name}}, sorry to hear you''re thinking about leaving! Before you go — how about 50% off your {{plan_name}} for the next 2 months? You''ve already gotten {{wash_count}} washes worth {{savings_amount}} in retail value. Want to keep that going? Reply YES to accept!',
  100,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM intervention_templates t
  WHERE t.organization_id = o.id AND t.name = 'Save Offer Response'
);

INSERT INTO intervention_templates (organization_id, name, template_type, channel, subject, body, priority, active)
SELECT
  o.id,
  'Confirm Cancel Response',
  'inbound_response',
  'sms',
  NULL,
  'We understand, {{first_name}}. Your {{plan_name}} membership will remain active through your current billing period. We''d love to have you back anytime. Reply JOIN to reactivate.',
  100,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM intervention_templates t
  WHERE t.organization_id = o.id AND t.name = 'Confirm Cancel Response'
);

INSERT INTO intervention_templates (organization_id, name, template_type, channel, subject, body, priority, active)
SELECT
  o.id,
  'Billing Info Response',
  'inbound_response',
  'sms',
  NULL,
  'Hi {{first_name}}, your current plan is {{plan_name}} at {{plan_price}}/mo. Need to make changes? Reply UPDATE or call us at {{site_phone}}.',
  100,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM intervention_templates t
  WHERE t.organization_id = o.id AND t.name = 'Billing Info Response'
);

INSERT INTO intervention_templates (organization_id, name, template_type, channel, subject, body, priority, active)
SELECT
  o.id,
  'Payment Update Response',
  'inbound_response',
  'sms',
  NULL,
  'Hi {{first_name}}, here''s your secure link to update your payment method: {{payment_update_link}}. This keeps your {{plan_name}} membership active.',
  100,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM intervention_templates t
  WHERE t.organization_id = o.id AND t.name = 'Payment Update Response'
);

INSERT INTO intervention_templates (organization_id, name, template_type, channel, subject, body, priority, active)
SELECT
  o.id,
  'Hours Location Response',
  'inbound_response',
  'sms',
  NULL,
  '{{site_name}} is open 7am-8pm daily. Come see us!',
  100,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM intervention_templates t
  WHERE t.organization_id = o.id AND t.name = 'Hours Location Response'
);

INSERT INTO intervention_templates (organization_id, name, template_type, channel, subject, body, priority, active)
SELECT
  o.id,
  'Complaint Response',
  'inbound_response',
  'sms',
  NULL,
  '{{first_name}}, we''re really sorry about your experience. Our manager has been notified and will follow up with you within 24 hours. We want to make this right.',
  100,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM intervention_templates t
  WHERE t.organization_id = o.id AND t.name = 'Complaint Response'
);

INSERT INTO intervention_templates (organization_id, name, template_type, channel, subject, body, priority, active)
SELECT
  o.id,
  'Compliment Response',
  'inbound_response',
  'sms',
  NULL,
  'Thanks so much, {{first_name}}! That means a lot to our team at {{site_name}}. We appreciate you being a member!',
  100,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM intervention_templates t
  WHERE t.organization_id = o.id AND t.name = 'Compliment Response'
);

INSERT INTO intervention_templates (organization_id, name, template_type, channel, subject, body, priority, active)
SELECT
  o.id,
  'Membership Question Response',
  'inbound_response',
  'sms',
  NULL,
  'Great question! We have several unlimited wash plans starting at $29.99/mo. Want to upgrade? Reply UPGRADE or visit our website to see all options.',
  100,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM intervention_templates t
  WHERE t.organization_id = o.id AND t.name = 'Membership Question Response'
);

INSERT INTO intervention_templates (organization_id, name, template_type, channel, subject, body, priority, active)
SELECT
  o.id,
  'Fallback Response',
  'inbound_response',
  'sms',
  NULL,
  'Thanks for reaching out, {{first_name}}. Let me connect you with our team. Someone will get back to you within 24 hours.',
  100,
  true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM intervention_templates t
  WHERE t.organization_id = o.id AND t.name = 'Fallback Response'
);
