-- Migration to add target visual and allowed assets to coding challenges
ALTER TABLE public.coding_challenges
ADD COLUMN IF NOT EXISTS target_visual_url TEXT,
ADD COLUMN IF NOT EXISTS allowed_assets JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.coding_challenges.target_visual_url IS 'URL for image or video the student should replicate';
COMMENT ON COLUMN public.coding_challenges.allowed_assets IS 'Array of strings containing links to assets (images, fonts, etc.)';
