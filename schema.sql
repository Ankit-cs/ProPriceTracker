-- Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  current_price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, url)
);

-- Enable Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create Policies for Products
CREATE POLICY "Users can manage their own products" 
  ON public.products 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

-- Create Price History Table
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Create Policies for Price History (users can read history of their own products)
CREATE POLICY "Users can view price history of their own products" 
  ON public.price_history 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.products 
      WHERE products.id = price_history.product_id 
      AND products.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert price history for their own products" 
  ON public.price_history 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products 
      WHERE products.id = price_history.product_id 
      AND products.user_id = auth.uid()
    )
  );
