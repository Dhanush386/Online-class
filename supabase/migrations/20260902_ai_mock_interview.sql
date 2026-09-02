-- ============================================================
-- Migration: AI Mock Interview Engine
-- Tables: mock_interview_sessions, mock_interview_turns, mock_interview_reports
-- ============================================================

-- 1. Create mock_interview_sessions table
CREATE TABLE IF NOT EXISTS public.mock_interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    track TEXT NOT NULL,
    question_count INTEGER NOT NULL CHECK (question_count > 0),
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    overall_score NUMERIC CHECK (overall_score >= 0 AND overall_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create mock_interview_turns table
CREATE TABLE IF NOT EXISTS public.mock_interview_turns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.mock_interview_sessions(id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL CHECK (turn_number > 0),
    question TEXT NOT NULL,
    student_answer TEXT,
    ai_feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_interview_session_turn UNIQUE (session_id, turn_number)
);

-- 3. Create mock_interview_reports table
CREATE TABLE IF NOT EXISTS public.mock_interview_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL UNIQUE REFERENCES public.mock_interview_sessions(id) ON DELETE CASCADE,
    category_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    strengths TEXT[] NOT NULL DEFAULT '{}',
    gaps TEXT[] NOT NULL DEFAULT '{}',
    model_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_mock_interview_sessions_student_status 
    ON public.mock_interview_sessions (student_id, status);

CREATE INDEX IF NOT EXISTS idx_mock_interview_sessions_created_at 
    ON public.mock_interview_sessions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mock_interview_turns_session_turn 
    ON public.mock_interview_turns (session_id, turn_number);

CREATE INDEX IF NOT EXISTS idx_mock_interview_reports_session 
    ON public.mock_interview_reports (session_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.mock_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_interview_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mock_interview_reports ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: mock_interview_sessions
DROP POLICY IF EXISTS "Students can view own interview sessions" ON public.mock_interview_sessions;
CREATE POLICY "Students can view own interview sessions" 
    ON public.mock_interview_sessions 
    FOR SELECT 
    USING (student_id = auth.uid() OR auth.jwt() ->> 'role' IN ('organizer', 'main_admin', 'sub_admin'));

DROP POLICY IF EXISTS "Students can create own interview sessions" ON public.mock_interview_sessions;
CREATE POLICY "Students can create own interview sessions" 
    ON public.mock_interview_sessions 
    FOR INSERT 
    WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can update own interview sessions" ON public.mock_interview_sessions;
CREATE POLICY "Students can update own interview sessions" 
    ON public.mock_interview_sessions 
    FOR UPDATE 
    USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Students can delete own interview sessions" ON public.mock_interview_sessions;
CREATE POLICY "Students can delete own interview sessions" 
    ON public.mock_interview_sessions 
    FOR DELETE 
    USING (student_id = auth.uid());

-- 7. RLS Policies: mock_interview_turns
DROP POLICY IF EXISTS "Students can view own interview turns" ON public.mock_interview_turns;
CREATE POLICY "Students can view own interview turns" 
    ON public.mock_interview_turns 
    FOR SELECT 
    USING (
        session_id IN (
            SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid()
        )
        OR auth.jwt() ->> 'role' IN ('organizer', 'main_admin', 'sub_admin')
    );

DROP POLICY IF EXISTS "Students can insert own interview turns" ON public.mock_interview_turns;
CREATE POLICY "Students can insert own interview turns" 
    ON public.mock_interview_turns 
    FOR INSERT 
    WITH CHECK (
        session_id IN (
            SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students can update own interview turns" ON public.mock_interview_turns;
CREATE POLICY "Students can update own interview turns" 
    ON public.mock_interview_turns 
    FOR UPDATE 
    USING (
        session_id IN (
            SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid()
        )
    );

-- 8. RLS Policies: mock_interview_reports
DROP POLICY IF EXISTS "Students can view own interview reports" ON public.mock_interview_reports;
CREATE POLICY "Students can view own interview reports" 
    ON public.mock_interview_reports 
    FOR SELECT 
    USING (
        session_id IN (
            SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid()
        )
        OR auth.jwt() ->> 'role' IN ('organizer', 'main_admin', 'sub_admin')
    );

DROP POLICY IF EXISTS "Students can insert own interview reports" ON public.mock_interview_reports;
CREATE POLICY "Students can insert own interview reports" 
    ON public.mock_interview_reports 
    FOR INSERT 
    WITH CHECK (
        session_id IN (
            SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Students can update own interview reports" ON public.mock_interview_reports;
CREATE POLICY "Students can update own interview reports" 
    ON public.mock_interview_reports 
    FOR UPDATE 
    USING (
        session_id IN (
            SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid()
        )
    );

-- 9. Optional XP Config Seed
INSERT INTO public.xp_config (event_type, xp_amount, coin_amount, streak_multiplier, first_attempt_multiplier, difficulty_multipliers, enabled)
VALUES (
    'mock_interview_complete',
    50,
    15,
    1.2,
    1.5,
    '{"easy": 1.0, "medium": 1.3, "hard": 1.8}'::jsonb,
    true
)
ON CONFLICT (event_type) DO NOTHING;
