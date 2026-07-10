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
      -- Enable real time for products
      BEGIN;
        DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' 
                AND tablename = 'products'
            ) THEN 
                ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
            END IF;
        END $$;
        
        -- Enable real time for price_history
        DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT 1 
                FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' 
                AND tablename = 'price_history'
            ) THEN 
                ALTER PUBLICATION supabase_realtime ADD TABLE public.price_history;
            END IF;
        END $$;
      COMMIT;
    `;

    await client.query(query);
    console.log("Realtime Migration executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

runMigration();
