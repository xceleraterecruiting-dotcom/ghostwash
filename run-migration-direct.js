const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  const migrationFile = process.argv[2] || './src/lib/db/migration-004-conversations.sql';
  console.log(`Running migration: ${migrationFile}\n`);

  const sql = fs.readFileSync(migrationFile, 'utf-8');

  // Remove comments and split by semicolon (handling multi-line statements)
  const cleanSql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 10);

  console.log(`Found ${statements.length} statements to execute.\n`);

  for (const stmt of statements) {
    if (!stmt) continue;

    // Get first line for preview
    const firstLine = stmt.split('\n')[0].trim();
    const preview = firstLine.substring(0, 70) + (firstLine.length > 70 || stmt.includes('\n') ? '...' : '');

    try {
      // For CREATE TABLE, we need to use the database function
      if (stmt.toLowerCase().startsWith('create table')) {
        const tableName = stmt.match(/create table if not exists (\w+)/i)?.[1];

        // First check if table exists
        const { data: check, error: checkError } = await supabase.from(tableName).select('*').limit(0);

        if (checkError && checkError.message.includes('does not exist')) {
          // Table doesn't exist, we need to create it manually
          console.log('⚠', preview);
          console.log('  → Table needs to be created in Supabase SQL Editor');
        } else {
          console.log('✓', preview, '(exists)');
        }
        continue;
      }

      if (stmt.toLowerCase().startsWith('create index')) {
        console.log('○', preview, '(run in SQL Editor)');
        continue;
      }

      if (stmt.toLowerCase().startsWith('alter table')) {
        console.log('○', preview, '(run in SQL Editor)');
        continue;
      }

      if (stmt.toLowerCase().startsWith('insert into')) {
        console.log('○', preview, '(run in SQL Editor)');
        continue;
      }

      console.log('○', preview);
    } catch (e) {
      console.log('✗', preview);
      console.log('  Error:', e.message);
    }
  }

  console.log('\n========================================');
  console.log('IMPORTANT: Run this migration manually!');
  console.log('========================================\n');
  console.log('1. Go to Supabase Dashboard → SQL Editor');
  console.log('2. Copy/paste the contents of:');
  console.log(`   ${migrationFile}`);
  console.log('3. Click "Run"\n');

  console.log('Verifying current table status...');

  // Verify key tables
  const { error: threadsError } = await supabase.from('conversation_threads').select('*').limit(0);
  const { error: convosError } = await supabase.from('customer_conversations').select('*').limit(0);

  if (!threadsError) {
    console.log('✓ conversation_threads table exists');
  } else {
    console.log('✗ conversation_threads table needs to be created');
  }

  if (!convosError) {
    console.log('✓ customer_conversations table exists');
  } else {
    console.log('✗ customer_conversations table needs to be created');
  }

  console.log('\n--- SQL to run in Supabase ---\n');
  console.log(sql);
}

runMigration();
