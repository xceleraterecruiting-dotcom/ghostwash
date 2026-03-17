-- Migration 003: Add fields for Daily Briefing, Notes/Tags, Drip System
-- Run this in Supabase SQL Editor

-- Add briefing_text to daily_briefings for Claude-generated content
ALTER TABLE daily_briefings
ADD COLUMN IF NOT EXISTS briefing_text TEXT;

-- Add notes, tags, and drip tracking to members
ALTER TABLE members
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS drip_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS drip_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS segment VARCHAR(20);

-- Add index for drip queries
CREATE INDEX IF NOT EXISTS idx_members_drip ON members(site_id, drip_step, plan_start_date);

-- Add index for segment queries
CREATE INDEX IF NOT EXISTS idx_members_segment ON members(site_id, segment);
