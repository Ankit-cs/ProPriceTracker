process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');
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

    const query = `
      ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS target_discount_percent NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_notified_price NUMERIC;
    `;

    await client.query(query);
    console.log("Migration executed successfully: Added target_discount_percent and last_notified_price.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

runMigration();
