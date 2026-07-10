-- Add geturl column to products table for storing PriceHistoryApp slugs
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS geturl TEXT;
