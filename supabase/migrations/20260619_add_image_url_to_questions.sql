-- Migration to add image_url to questions table
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url text;
