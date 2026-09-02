-- Migration: Add slide_url to videos table
-- Enables side-by-side presentation of slides and video

ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS slide_url TEXT;

COMMENT ON COLUMN public.videos.slide_url IS 'URL to the associated PPT/PDF slides for this video lesson';
