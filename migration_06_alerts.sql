-- Add user-specific columns to user_tracked_products
ALTER TABLE public.user_tracked_products ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.user_tracked_products ADD COLUMN IF NOT EXISTS target_discount_percent NUMERIC DEFAULT 0;
ALTER TABLE public.user_tracked_products ADD COLUMN IF NOT EXISTS last_notified_price NUMERIC;
ALTER TABLE public.user_tracked_products ADD COLUMN IF NOT EXISTS pincode TEXT;

-- Migrate values from products to user_tracked_products for matches
UPDATE public.user_tracked_products utp
SET 
  alerts_enabled = p.alerts_enabled,
  target_discount_percent = p.target_discount_percent,
  last_notified_price = p.last_notified_price,
  pincode = p.pincode
FROM public.products p
WHERE utp.product_id = p.id AND p.user_id = utp.user_id;
