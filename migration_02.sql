-- Add region setting to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'us';

-- Add new columns to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS sold_by TEXT,
ADD COLUMN IF NOT EXISTS delivery_date TEXT,
ADD COLUMN IF NOT EXISTS frequently_bought_together JSONB;
