process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL.");

    const sqlPath = path.join(__dirname, 'migration_02.sql');
    const query = fs.readFileSync(sqlPath, 'utf8');

    await client.query(query);
    console.log("Migration executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

runMigration();
