const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.ufpkvotcfmyznquivxjz:Ankitkum%40123@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS scraping_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url TEXT NOT NULL,
        user_id UUID,
        status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
        product_id UUID,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("scraping_jobs table created");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
