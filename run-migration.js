const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: 'db.fnmjkdrqkupawemuoeud.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'Reiandnami2022!!',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const sql = fs.readFileSync(
      path.join(__dirname, 'src/lib/db/migration-002-subscription.sql'),
      'utf8'
    );

    console.log('Running migration...');
    await client.query(sql);
    console.log('Migration completed successfully!');

  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
