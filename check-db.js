require('dotenv').config();
const { Client } = require('pg');

async function checkDb() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  console.log("Tables:", res.rows.map(r => r.table_name).join(", "));
  
  try {
    const counts = await client.query(`SELECT COUNT(*) FROM public.portfolios`);
    console.log("Portfolios count:", counts.rows[0].count);
  } catch (e) {
    console.error("Portfolios table error:", e.message);
  }
  
  await client.end();
}
checkDb();
