ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'mcq',
ADD COLUMN IF NOT EXISTS code_snippet TEXT,
ADD COLUMN IF NOT EXISTS code_language TEXT DEFAULT 'javascript',
ADD COLUMN IF NOT EXISTS snippet_title TEXT;

COMMENT ON COLUMN public.questions.question_type IS 'Type of question, e.g., mcq or code_mcq';
COMMENT ON COLUMN public.questions.code_snippet IS 'Code snippet for Code Based MCQ questions';
COMMENT ON COLUMN public.questions.code_language IS 'Language of the code snippet';
COMMENT ON COLUMN public.questions.snippet_title IS 'Optional title for the code snippet';
