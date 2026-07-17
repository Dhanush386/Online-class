-- Add additional missing fields to coding_challenges table
ALTER TABLE public.coding_challenges
    ADD COLUMN IF NOT EXISTS challenge_version INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS difficulty_score INTEGER DEFAULT 50,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published';
