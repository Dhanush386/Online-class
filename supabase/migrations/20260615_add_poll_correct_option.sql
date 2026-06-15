-- Migration to add correct_option to live polls
ALTER TABLE public.live_polls ADD COLUMN IF NOT EXISTS correct_option TEXT;
