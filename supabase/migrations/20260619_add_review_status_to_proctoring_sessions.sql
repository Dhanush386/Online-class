-- Add review_status and ai_summary columns to proctoring_sessions
ALTER TABLE public.proctoring_sessions 
ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) DEFAULT 'pending' NOT NULL,
ADD COLUMN IF NOT EXISTS ai_summary TEXT;

