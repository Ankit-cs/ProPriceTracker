-- Add pincode setting to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS pincode TEXT;
