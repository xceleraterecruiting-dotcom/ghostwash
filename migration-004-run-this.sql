-- Migration 004: Tables, indexes, and columns
-- Copy this entire file and paste into Supabase SQL Editor

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_threads_site ON conversation_threads(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_member ON conversation_threads(member_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON conversation_threads(site_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_phone ON conversation_threads(member_phone);
CREATE INDEX IF NOT EXISTS idx_conversations_thread ON customer_conversations(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_site ON customer_conversations(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_intent ON customer_conversations(site_id, classified_intent);

-- Twilio columns on sites
ALTER TABLE sites ADD COLUMN IF NOT EXISTS twilio_number VARCHAR(20);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS twilio_number_sid VARCHAR(50);
