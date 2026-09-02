-- Add solution_code to coding_challenges
ALTER TABLE public.coding_challenges ADD COLUMN IF NOT EXISTS solution_code TEXT;
