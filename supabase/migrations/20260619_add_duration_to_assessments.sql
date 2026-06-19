-- Add duration column (in minutes) to assessments table, defaulting to 30 minutes
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30;
