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
      CREATE TABLE IF NOT EXISTS product_subscribers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id),
        email TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(product_id, email)
      );
    `);
    console.log("Table created");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
