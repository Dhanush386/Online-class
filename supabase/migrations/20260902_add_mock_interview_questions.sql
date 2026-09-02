-- ============================================================
-- Migration: Organizer Mock Interview Custom Questions
-- Tables: mock_interview_custom_questions
-- Views: mock_interview_questions_public (hides sample_answer from students)
-- ============================================================

-- 1. Create mock_interview_custom_questions table
CREATE TABLE IF NOT EXISTS public.mock_interview_custom_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    track TEXT NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    question TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    category TEXT,
    sample_answer TEXT, -- Instructor rubric / ideal answer (strictly hidden from students)
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_mock_interview_custom_questions_track_active 
    ON public.mock_interview_custom_questions (track, is_active, order_index);

CREATE INDEX IF NOT EXISTS idx_mock_interview_custom_questions_course 
    ON public.mock_interview_custom_questions (course_id);

-- 3. Enable RLS on base table
ALTER TABLE public.mock_interview_custom_questions ENABLE ROW LEVEL SECURITY;

-- 4. RLS: Base table access is STRICTLY RESTRICTED to organizers and administrators
-- Students CANNOT query this table directly, preventing any leakage of sample_answer.
DROP POLICY IF EXISTS "Staff full access to mock interview questions" ON public.mock_interview_custom_questions;
CREATE POLICY "Staff full access to mock interview questions" 
    ON public.mock_interview_custom_questions 
    FOR ALL 
    USING (
        (SELECT public.is_staff()) 
        OR auth.jwt() ->> 'role' IN ('organizer', 'main_admin', 'sub_admin')
    )
    WITH CHECK (
        (SELECT public.is_staff()) 
        OR auth.jwt() ->> 'role' IN ('organizer', 'main_admin', 'sub_admin')
    );

-- 5. Secure View for Students (Omits sample_answer completely)
CREATE OR REPLACE VIEW public.mock_interview_questions_public AS
SELECT 
    id,
    track,
    course_id,
    question,
    difficulty,
    category,
    order_index,
    is_active,
    created_at
FROM public.mock_interview_custom_questions
WHERE is_active = true;

-- Grant SELECT access on the public view to authenticated users
GRANT SELECT ON public.mock_interview_questions_public TO authenticated;
GRANT SELECT ON public.mock_interview_questions_public TO anon;
