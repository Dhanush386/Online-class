-- Add open_time and close_time to assessments for per-assessment scheduling
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS open_time TIMESTAMPTZ;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS close_time TIMESTAMPTZ;
