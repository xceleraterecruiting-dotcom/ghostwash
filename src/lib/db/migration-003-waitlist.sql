-- Waitlist table for capturing leads
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  wash_name TEXT NOT NULL,
  location_count TEXT NOT NULL,
  pos_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index on email for quick lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);

-- Index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);

-- RLS policies for waitlist (service role only - no public access)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write
CREATE POLICY "Service role full access" ON waitlist
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
