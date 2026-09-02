-- Migration: Add reference iframe URL and required keywords to coding challenges
-- Enables the Reference iFrame embed and Keyword Validation features

ALTER TABLE public.coding_challenges
ADD COLUMN IF NOT EXISTS reference_iframe_url TEXT,
ADD COLUMN IF NOT EXISTS required_keywords JSONB DEFAULT NULL;

COMMENT ON COLUMN public.coding_challenges.reference_iframe_url IS 'HTTPS URL to embed as a reference iframe in the student challenge view (HTML challenges only)';
COMMENT ON COLUMN public.coding_challenges.required_keywords IS 'JSON object specifying required keywords per language file: { "html": ["table"], "css": ["display:flex"], "js": ["addEventListener"] }';
