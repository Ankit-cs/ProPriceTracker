-- Add features (JSONB) and description (TEXT) columns to the products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS features JSONB;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description TEXT;

-- Create user_settings table for webhook notifications
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create Policies for user_settings
CREATE POLICY "Users can manage their own settings" 
  ON public.user_settings 
  FOR ALL 
  TO authenticated 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);
