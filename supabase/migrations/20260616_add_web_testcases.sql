-- Migration: Add web_testcases JSONB column for the Frontend Testcase Engine
-- This powers the HackerRank-style HTML/CSS/JS validation in coding challenges

ALTER TABLE public.coding_challenges
ADD COLUMN IF NOT EXISTS web_testcases JSONB DEFAULT NULL;

COMMENT ON COLUMN public.coding_challenges.web_testcases IS 'Frontend testcase engine spec: { "html": [{"description":"Form exists","selector":"form","minCount":1}], "css": [{"description":"Uses flexbox","selector":".container","property":"display","value":"flex"}], "js": [{"description":"Uses addEventListener","keyword":"addEventListener"}] }';
