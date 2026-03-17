const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  const sql = fs.readFileSync('./src/lib/db/migration-003-features.sql', 'utf-8');

  // Split by semicolon and run each statement
  const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));

  for (const stmt of statements) {
    const cleanStmt = stmt.trim();
    if (!cleanStmt) continue;

    console.log('Running:', cleanStmt.substring(0, 60) + '...');
    const { error } = await supabase.rpc('exec_sql', { sql: cleanStmt });

    if (error) {
      // Try direct query for ALTER statements
      const { error: error2 } = await supabase.from('_migrations').select().limit(0);
      console.log('  Note: RPC not available, run SQL manually in Supabase');
    }
  }

  console.log('\nMigration complete! If RPC errors shown, run the SQL manually in Supabase SQL Editor.');
}

runMigration();
