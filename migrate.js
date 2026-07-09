const { Client } = require('pg');
require('dotenv').config(); // Need to load from .env

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
      ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS short_description TEXT,
      ADD COLUMN IF NOT EXISTS full_description TEXT,
      ADD COLUMN IF NOT EXISTS is_amazon_choice BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_discounted BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS original_price NUMERIC,
      ADD COLUMN IF NOT EXISTS amazon_id TEXT;
    `;

    await client.query(query);
    console.log("Migration executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

runMigration();
