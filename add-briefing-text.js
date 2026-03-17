const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumn() {
  // Test if column exists by trying to select it
  const { error } = await supabase
    .from('daily_briefings')
    .select('briefing_text')
    .limit(1);

  if (error && error.message.includes('briefing_text')) {
    console.log('Column does not exist. Run this SQL in Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE daily_briefings ADD COLUMN IF NOT EXISTS briefing_text TEXT;');
    console.log('');
  } else {
    console.log('Column already exists or table is ready.');
  }
}

addColumn();
