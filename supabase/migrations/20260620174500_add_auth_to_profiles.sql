-- Add netease_auth and qq_auth columns to public.profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS netease_auth JSONB,
ADD COLUMN IF NOT EXISTS qq_auth JSONB;
