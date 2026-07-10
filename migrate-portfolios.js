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
      CREATE TABLE IF NOT EXISTS public.portfolios (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can manage their own portfolios" ON public.portfolios;
      CREATE POLICY "Users can manage their own portfolios" 
        ON public.portfolios 
        FOR ALL 
        TO authenticated 
        USING (auth.uid() = user_id) 
        WITH CHECK (auth.uid() = user_id);

      CREATE TABLE IF NOT EXISTS public.portfolio_items (
        portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
        product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
        PRIMARY KEY (portfolio_id, product_id)
      );

      ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can manage their own portfolio items" ON public.portfolio_items;
      CREATE POLICY "Users can manage their own portfolio items" 
        ON public.portfolio_items 
        FOR ALL 
        TO authenticated 
        USING (
          EXISTS (
            SELECT 1 FROM public.portfolios 
            WHERE portfolios.id = portfolio_items.portfolio_id 
            AND portfolios.user_id = auth.uid()
          )
        ) 
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.portfolios 
            WHERE portfolios.id = portfolio_items.portfolio_id 
            AND portfolios.user_id = auth.uid()
          )
        );
    `;

    await client.query(query);
    console.log("Portfolios Migration executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await client.end();
  }
}

runMigration();
