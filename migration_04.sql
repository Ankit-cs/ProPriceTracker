-- Add pincode to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS pincode TEXT;
