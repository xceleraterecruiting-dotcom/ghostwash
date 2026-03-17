-- GhostWash Database Schema v1
-- Phase 1: Membership Agent
-- Run this against your Supabase PostgreSQL instance

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255),
  owner_email VARCHAR(255) NOT NULL UNIQUE,
  owner_phone VARCHAR(20),
  pos_type VARCHAR(50) NOT NULL, -- washify, drb_patheon, drb_sitewatch, sonnys, ics, nxt, csv_import
  pos_credentials JSONB DEFAULT '{}', -- encrypted API keys / connection details
  tier_plan VARCHAR(20) DEFAULT 'operator', -- operator, portfolio, enterprise
  billing_status VARCHAR(20) DEFAULT 'trial', -- trial, active, past_due, cancelled
  stripe_customer_id VARCHAR(255),
  settings JSONB DEFAULT '{}', -- org-wide defaults for guardrails, comms prefs, etc
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SITES
-- ============================================================
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  pos_site_id VARCHAR(255), -- ID in the POS system
  operating_hours JSONB DEFAULT '{}', -- {mon: {open: "07:00", close: "20:00"}, ...}
  settings JSONB DEFAULT '{}', -- site-specific overrides
  status VARCHAR(20) DEFAULT 'active', -- active, paused, inactive
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sites_org ON sites(organization_id);

-- ============================================================
-- MEMBERS
-- ============================================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  pos_member_id VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  plan_name VARCHAR(255),
  plan_price_cents INTEGER, -- price in cents
  plan_start_date DATE,
  plan_status VARCHAR(20) DEFAULT 'active', -- active, paused, cancelled, past_due
  payment_status VARCHAR(20) DEFAULT 'current', -- current, declined, retry_pending
  last_payment_date TIMESTAMPTZ,
  last_payment_failure TIMESTAMPTZ,
  payment_failure_count INTEGER DEFAULT 0,
  vehicles JSONB DEFAULT '[]', -- [{plate, make, model, year}]
  ltv_cents INTEGER DEFAULT 0, -- lifetime value in cents
  churn_score DECIMAL(5,2) DEFAULT 0, -- 0-100
  churn_score_updated_at TIMESTAMPTZ,
  last_wash_date TIMESTAMPTZ,
  wash_count_30d INTEGER DEFAULT 0,
  wash_count_total INTEGER DEFAULT 0,
  avg_wash_frequency_days DECIMAL(5,1),
  onboarding_step INTEGER DEFAULT 0, -- 0=not started, 1-5=drip steps, 6=complete
  onboarding_next_send TIMESTAMPTZ,
  do_not_contact BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, pos_member_id)
);

CREATE INDEX idx_members_site ON members(site_id);
CREATE INDEX idx_members_churn ON members(site_id, churn_score DESC) WHERE plan_status = 'active';
CREATE INDEX idx_members_payment ON members(site_id, payment_status) WHERE payment_status != 'current';
CREATE INDEX idx_members_onboarding ON members(site_id, onboarding_step) WHERE onboarding_step BETWEEN 1 AND 5;

-- ============================================================
-- WASHES (transactions)
-- ============================================================
CREATE TABLE washes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  pos_transaction_id VARCHAR(255),
  wash_type VARCHAR(50), -- basic, premium, ultimate, etc
  amount_cents INTEGER,
  payment_method VARCHAR(20), -- membership, credit_card, cash
  vehicle_plate VARCHAR(20),
  washed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, pos_transaction_id)
);

CREATE INDEX idx_washes_site_date ON washes(site_id, washed_at DESC);
CREATE INDEX idx_washes_member ON washes(member_id, washed_at DESC);

-- ============================================================
-- AGENT ACTIONS (audit trail)
-- ============================================================
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  agent VARCHAR(30) NOT NULL, -- membership, customer, revenue, operations, command
  action_type VARCHAR(50) NOT NULL, -- churn_winback, cc_retry, onboarding_msg, review_request, etc
  tier INTEGER NOT NULL, -- 1, 2, or 3
  status VARCHAR(20) DEFAULT 'executed', -- executed, pending_approval, overridden, failed, cancelled
  target_type VARCHAR(30), -- member, site, campaign, schedule, order
  target_id UUID,
  decision_data JSONB DEFAULT '{}', -- inputs: churn_score, weather, visit_freq, etc
  action_data JSONB DEFAULT '{}', -- what was done: {channel, template_id, offer, msg_id}
  outcome_data JSONB, -- what happened: {opened, clicked, washed_again, converted}
  operator_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_actions_site_date ON agent_actions(site_id, created_at DESC);
CREATE INDEX idx_actions_status ON agent_actions(status) WHERE status = 'pending_approval';
CREATE INDEX idx_actions_outcome ON agent_actions(id) WHERE outcome_data IS NULL AND status = 'executed';

-- ============================================================
-- INTERVENTION TEMPLATES
-- ============================================================
CREATE TABLE intervention_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_type VARCHAR(50) NOT NULL, -- churn_winback, cc_decline, onboarding_day0/3/7/14/30, review_request
  channel VARCHAR(20) NOT NULL, -- email, sms
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255), -- email subject (nullable for SMS)
  body TEXT NOT NULL, -- template with {{variables}}
  offer_type VARCHAR(50), -- free_upgrade, discount_10pct, pause_1month, none
  offer_value VARCHAR(100),
  priority INTEGER DEFAULT 0, -- higher = preferred by AI selection
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_org_type ON intervention_templates(organization_id, template_type, channel);

-- ============================================================
-- GUARDRAILS
-- ============================================================
CREATE TABLE guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE, -- null = org-wide
  category VARCHAR(50) NOT NULL, -- pricing, staffing, spending, comms, operations, escalation
  rule_key VARCHAR(100) NOT NULL, -- max_retail_price_delta_cents, max_msgs_per_member_week, etc
  rule_value JSONB NOT NULL, -- {value: 200, unit: "cents"}
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, site_id, rule_key)
);

-- ============================================================
-- TIER ASSIGNMENTS
-- ============================================================
CREATE TABLE tier_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE CASCADE, -- null = org-wide
  decision_type VARCHAR(50) NOT NULL, -- churn_winback, cc_retry, onboarding, schedule_build, etc
  tier INTEGER NOT NULL DEFAULT 2, -- 1, 2, or 3
  consecutive_correct INTEGER DEFAULT 0, -- track for upgrade eligibility
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, site_id, decision_type)
);

-- ============================================================
-- DAILY BRIEFINGS
-- ============================================================
CREATE TABLE daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  briefing_date DATE NOT NULL,
  metrics JSONB DEFAULT '{}', -- {cars_washed, revenue_cents, members_saved, members_lost, new_members, active_members}
  actions_summary JSONB DEFAULT '[]', -- [{agent, action_type, count, outcomes}]
  recommendations JSONB DEFAULT '[]', -- Tier 3 items needing input
  weather_forecast JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, briefing_date)
);

-- ============================================================
-- POS SYNC LOG
-- ============================================================
CREATE TABLE pos_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- full_sync, incremental, webhook
  records_synced INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'running' -- running, success, partial, failed
);

CREATE INDEX idx_sync_site_date ON pos_sync_log(site_id, started_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_sites_updated BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON intervention_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
