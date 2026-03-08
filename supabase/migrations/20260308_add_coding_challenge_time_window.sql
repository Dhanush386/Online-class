-- Add time window columns to coding_challenges
ALTER TABLE coding_challenges ADD COLUMN IF NOT EXISTS open_time timestamptz;
ALTER TABLE coding_challenges ADD COLUMN IF NOT EXISTS close_time timestamptz;
