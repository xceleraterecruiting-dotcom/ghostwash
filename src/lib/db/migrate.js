const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Load env
  require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') });

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('Missing DATABASE_URL in .env.local');
    process.exit(1);
  }

  console.log('Connecting to Supabase PostgreSQL...');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!\n');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('Running schema.sql...\n');

    await client.query(schema);

    console.log('✓ Schema created successfully!\n');

    // Verify tables
    const { rows } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('Tables created:');
    rows.forEach(r => console.log(`  - ${r.table_name}`));

  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
