-- Migration 006: POS Integration
-- Adds POS adapter support to sites and sync logging

-- Add POS fields to sites table
ALTER TABLE sites ADD COLUMN IF NOT EXISTS pos_type VARCHAR(20) DEFAULT 'csv_import';
ALTER TABLE sites ADD COLUMN IF NOT EXISTS pos_api_key TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS pos_api_secret TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS pos_company_id VARCHAR(100);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS pos_location_id VARCHAR(100);
ALTER TABLE sites ADD COLUMN IF NOT EXISTS pos_last_sync TIMESTAMPTZ;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS pos_sync_status VARCHAR(20) DEFAULT 'not_configured';

-- Create enum check for pos_type
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_pos_type_check;
ALTER TABLE sites ADD CONSTRAINT sites_pos_type_check
  CHECK (pos_type IN ('csv_import', 'washify', 'drb', 'rinsed', 'everwash', 'other'));

-- Create enum check for pos_sync_status
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_pos_sync_status_check;
ALTER TABLE sites ADD CONSTRAINT sites_pos_sync_status_check
  CHECK (pos_sync_status IN ('connected', 'syncing', 'failed', 'not_configured', 'stale'));

-- POS Sync Log table
CREATE TABLE IF NOT EXISTS pos_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  sync_type VARCHAR(20) NOT NULL, -- 'full' or 'incremental'
  records_synced INTEGER DEFAULT 0,
  members_synced INTEGER DEFAULT 0,
  washes_synced INTEGER DEFAULT 0,
  payments_synced INTEGER DEFAULT 0,
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'partial'
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_sync_log_site ON pos_sync_log(site_id);
CREATE INDEX IF NOT EXISTS idx_pos_sync_log_status ON pos_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_pos_sync_log_started ON pos_sync_log(started_at DESC);

-- Wash events table (for tracking individual washes from POS)
CREATE TABLE IF NOT EXISTS wash_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  external_id VARCHAR(100), -- POS system's ID for this wash
  wash_type VARCHAR(50), -- 'basic', 'plus', 'unlimited', etc.
  washed_at TIMESTAMPTZ NOT NULL,
  lane VARCHAR(20),
  duration_seconds INTEGER,
  raw_data JSONB, -- Store original POS data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_wash_events_site ON wash_events(site_id);
CREATE INDEX IF NOT EXISTS idx_wash_events_member ON wash_events(member_id);
CREATE INDEX IF NOT EXISTS idx_wash_events_washed_at ON wash_events(washed_at DESC);

-- Payment events table (for tracking payment attempts from POS)
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  external_id VARCHAR(100), -- POS system's ID
  event_type VARCHAR(30) NOT NULL, -- 'charge_success', 'charge_failed', 'refund', 'chargeback'
  amount_cents INTEGER,
  failure_reason VARCHAR(100),
  card_last_four VARCHAR(4),
  occurred_at TIMESTAMPTZ NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_events_site ON payment_events(site_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_member ON payment_events(member_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type ON payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_occurred ON payment_events(occurred_at DESC);

-- Plan change events table
CREATE TABLE IF NOT EXISTS plan_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  external_id VARCHAR(100),
  change_type VARCHAR(30) NOT NULL, -- 'upgrade', 'downgrade', 'cancel', 'reactivate', 'new'
  from_plan VARCHAR(100),
  to_plan VARCHAR(100),
  reason VARCHAR(200),
  occurred_at TIMESTAMPTZ NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_change_events_site ON plan_change_events(site_id);
CREATE INDEX IF NOT EXISTS idx_plan_change_events_member ON plan_change_events(member_id);
CREATE INDEX IF NOT EXISTS idx_plan_change_events_type ON plan_change_events(change_type);

COMMENT ON TABLE pos_sync_log IS 'Log of POS synchronization attempts';
COMMENT ON TABLE wash_events IS 'Individual wash transactions from POS';
COMMENT ON TABLE payment_events IS 'Payment events (success/failure) from POS';
COMMENT ON TABLE plan_change_events IS 'Membership plan changes from POS';
