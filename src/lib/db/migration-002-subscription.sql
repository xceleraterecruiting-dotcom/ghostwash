-- Migration 002: Add subscription fields to organizations
-- Run this in Supabase SQL Editor

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_period_ends_at TIMESTAMPTZ;

-- Add source tracking to members (online signup vs CSV import)
ALTER TABLE members
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'import',
ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS join_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS churn_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS cc_last_failed TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cc_fail_count INTEGER DEFAULT 0;

-- Create index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_members_stripe ON members(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_stripe ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
