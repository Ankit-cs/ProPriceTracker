-- 1. Create user_tracked_products table
CREATE TABLE IF NOT EXISTS public.user_tracked_products (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

-- Enable RLS for user_tracked_products
ALTER TABLE public.user_tracked_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their tracked products" ON public.user_tracked_products;
CREATE POLICY "Users can manage their tracked products" 
  ON public.user_tracked_products 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- 2. Migrate existing tracking data (optional but good for preservation)
INSERT INTO public.user_tracked_products (user_id, product_id, created_at)
SELECT user_id, id, created_at FROM public.products
ON CONFLICT DO NOTHING;

-- 3. Modify products table
-- First, drop the unique constraint on (user_id, url)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_url_key;

-- Make user_id nullable since products are now global (kept for legacy reasons or initial creator)
ALTER TABLE public.products ALTER COLUMN user_id DROP NOT NULL;

-- Add new aggregate columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS lowest_price NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS highest_price NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS average_price NUMERIC;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_rate NUMERIC;

-- In a perfect world, we would add a unique constraint on url: ALTER TABLE public.products ADD CONSTRAINT products_url_key UNIQUE(url);
-- But there might be duplicate URLs in the current table for different users. We'll leave it without the DB-level constraint for now to avoid migration crashes, but we'll enforce it in the app logic.

-- 4. Update products RLS policies
DROP POLICY IF EXISTS "Users can manage their own products" ON public.products;
DROP POLICY IF EXISTS "Anyone can read products" ON public.products;
CREATE POLICY "Anyone can read products" 
  ON public.products 
  FOR SELECT 
  TO authenticated 
  USING (true);
  
DROP POLICY IF EXISTS "Anyone can insert products" ON public.products;
CREATE POLICY "Anyone can insert products" 
  ON public.products 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
  
DROP POLICY IF EXISTS "Anyone can update products" ON public.products;
CREATE POLICY "Anyone can update products" 
  ON public.products 
  FOR UPDATE 
  TO authenticated 
  USING (true)
  WITH CHECK (true);

-- 5. Update price_history RLS policies
DROP POLICY IF EXISTS "Users can view price history of their own products" ON public.price_history;
DROP POLICY IF EXISTS "Users can insert price history for their own products" ON public.price_history;

DROP POLICY IF EXISTS "Anyone can read price history" ON public.price_history;
CREATE POLICY "Anyone can read price history" 
  ON public.price_history 
  FOR SELECT 
  TO authenticated 
  USING (true);
  
DROP POLICY IF EXISTS "Anyone can insert price history" ON public.price_history;
CREATE POLICY "Anyone can insert price history" 
  ON public.price_history 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
