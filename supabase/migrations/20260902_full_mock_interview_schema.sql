-- ==============================================================================
-- LEARNNOVA: Consolidated AI Mock Interview Schema & Question Bank Migration
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query)
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Mock Interview Sessions: Video Recording Columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.mock_interview_sessions
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS recording_expires_at TIMESTAMPTZ;

-- Storage Bucket for Interview Recordings (Private: Only student & organizer have access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('interview-recordings', 'interview-recordings', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Policies: Attended student & Organizer/Admin ONLY
DROP POLICY IF EXISTS "Public Select Access for Interview Recordings" ON storage.objects;
DROP POLICY IF EXISTS "Access Interview Recordings" ON storage.objects;
CREATE POLICY "Access Interview Recordings" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'interview-recordings'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR (SELECT public.is_staff())
            OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
        )
    );

DROP POLICY IF EXISTS "Authenticated Insert Access for Student Interview Recordings" ON storage.objects;
CREATE POLICY "Authenticated Insert Access for Student Interview Recordings" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'interview-recordings'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Authenticated Delete Access for Interview Recordings" ON storage.objects;
CREATE POLICY "Authenticated Delete Access for Interview Recordings" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'interview-recordings'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR (SELECT public.is_staff())
            OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
        )
    );

-- ─────────────────────────────────────────────────────────────
-- 2. Mock Interview Custom Questions (Question Bank)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mock_interview_custom_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    track TEXT NOT NULL,
    question TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    category TEXT,
    sample_answer TEXT, -- Confidential grading rubric / model answer
    order_index INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for fast retrieval
CREATE INDEX IF NOT EXISTS idx_mock_q_track_active 
ON public.mock_interview_custom_questions(track, is_active, order_index);

CREATE INDEX IF NOT EXISTS idx_mock_q_course 
ON public.mock_interview_custom_questions(course_id);

-- Enable Row Level Security (RLS) on Base Table
ALTER TABLE public.mock_interview_custom_questions ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 3. RLS Security: Strict Instructor/Admin Access to Base Table
-- (Students CANNOT SELECT sample_answer / answer key directly)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Organizers and Admins can view custom questions" ON public.mock_interview_custom_questions;
CREATE POLICY "Organizers and Admins can view custom questions"
ON public.mock_interview_custom_questions
FOR SELECT
TO authenticated
USING (
    (SELECT public.is_staff())
    OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
);

DROP POLICY IF EXISTS "Organizers and Admins can insert custom questions" ON public.mock_interview_custom_questions;
CREATE POLICY "Organizers and Admins can insert custom questions"
ON public.mock_interview_custom_questions
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT public.is_staff())
    OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
);

DROP POLICY IF EXISTS "Organizers and Admins can update custom questions" ON public.mock_interview_custom_questions;
CREATE POLICY "Organizers and Admins can update custom questions"
ON public.mock_interview_custom_questions
FOR UPDATE
TO authenticated
USING (
    (SELECT public.is_staff())
    OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
)
WITH CHECK (
    (SELECT public.is_staff())
    OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
);

DROP POLICY IF EXISTS "Organizers and Admins can delete custom questions" ON public.mock_interview_custom_questions;
CREATE POLICY "Organizers and Admins can delete custom questions"
ON public.mock_interview_custom_questions
FOR DELETE
TO authenticated
USING (
    (SELECT public.is_staff())
    OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
);

-- ─────────────────────────────────────────────────────────────
-- 4. Public Student View (Omits sample_answer)
-- ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.mock_interview_questions_public;
CREATE VIEW public.mock_interview_questions_public
WITH (security_invoker = false)
AS
SELECT 
    id,
    created_by,
    course_id,
    track,
    question,
    difficulty,
    category,
    order_index,
    is_active,
    created_at,
    updated_at
FROM public.mock_interview_custom_questions
WHERE is_active = true;

GRANT SELECT ON public.mock_interview_questions_public TO authenticated;
GRANT SELECT ON public.mock_interview_questions_public TO anon;

-- ─────────────────────────────────────────────────────────────
-- 5. Seed Starter Questions (Industry Standards)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.mock_interview_custom_questions (track, category, difficulty, question, sample_answer, order_index, is_active)
VALUES
  (
    'Frontend Development',
    'Core React & Reconciliation',
    'intermediate',
    'Explain how React''s reconciliation algorithm and Virtual DOM diffing work. What heuristics does React use to achieve O(n) diffing complexity?',
    'Expected points: 1) Two elements of different types produce different trees. 2) Keys identify which child elements may be stable across renders. 3) Fiber architecture introduces work units that can be paused/aborted. 4) Contrast between shallow comparison vs deep object equality.',
    1,
    true
  ),
  (
    'Frontend Development',
    'Performance Optimization',
    'advanced',
    'Walk me through how you would diagnose, profile, and fix memory leaks and unnecessary re-renders in a high-frequency React application.',
    'Expected points: 1) React Profiler flamegraph and commit phase inspection. 2) Chrome DevTools heap snapshots, allocation instrumentation on timeline. 3) Proper memoization strategies (useMemo, useCallback, React.memo) with reference stability. 4) Virtualization of large lists (react-window/tanstack-virtual). 5) Cleanup routines in useEffect subscriptions and AbortControllers.',
    2,
    true
  ),
  (
    'Backend Engineering',
    'Database & Indexing',
    'intermediate',
    'Explain the differences between B-Tree and Hash indexing in PostgreSQL. Under what scenarios would you choose one over the other?',
    'Expected points: 1) B-Trees support range queries (<, <=, =, >=, BETWEEN) and ordering (ORDER BY). 2) Hash indexes only support equality operators (=). 3) Write amplification and maintenance cost during high insertion throughput. 4) Explain ANALYZE query planning inspection.',
    1,
    true
  ),
  (
    'Backend Engineering',
    'Distributed Systems',
    'advanced',
    'How do you handle idempotency in payment processing or distributed API endpoints? Walk me through database constraints, caching, and race condition mitigation.',
    'Expected points: 1) Idempotency-Key header passed by client. 2) Unique database constraint on idempotency key with status tracking (STARTED, COMPLETED). 3) Redis distributed lock or advisory locks during in-flight processing. 4) Replaying cached response payload on duplicate requests without double charging.',
    2,
    true
  ),
  (
    'DSA & Algorithms',
    'Graph Algorithms',
    'intermediate',
    'Given a directed graph representing package dependencies, describe how you would detect circular dependencies and generate a valid build order.',
    'Expected points: 1) Topological sort using Kahn''s algorithm (in-degree array + BFS queue) or DFS with 3-color cycle detection (white/gray/black). 2) Time complexity O(V + E) and Space complexity O(V + E). 3) Explaining why DAG is a prerequisite.',
    1,
    true
  ),
  (
    'Fullstack Development',
    'Security & Authentication',
    'intermediate',
    'Compare JWT stored in httpOnly Cookies versus localStorage in terms of XSS and CSRF attack surfaces, and explain your defense strategy.',
    'Expected points: 1) localStorage vulnerable to XSS token theft via script injection. 2) httpOnly cookies immune to JavaScript theft, but vulnerable to CSRF. 3) CSRF mitigation via SameSite=Strict/Lax, anti-CSRF token (double submit cookie). 4) Short-lived access tokens with refresh token rotation.',
    1,
    true
  )
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 6. Strict Privacy & Security Access Control:
-- Attended Student and Organizer/Admin ONLY can view/delete videos and results
-- ─────────────────────────────────────────────────────────────

-- 6.1 Table Policies: mock_interview_sessions
DROP POLICY IF EXISTS "Students can view own interview sessions" ON public.mock_interview_sessions;
DROP POLICY IF EXISTS "Students and organizers can view interview sessions" ON public.mock_interview_sessions;
CREATE POLICY "Students and organizers can view interview sessions"
    ON public.mock_interview_sessions
    FOR SELECT TO authenticated
    USING (
        student_id = auth.uid()
        OR (SELECT public.is_staff())
        OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
    );

DROP POLICY IF EXISTS "Students can delete own interview sessions" ON public.mock_interview_sessions;
DROP POLICY IF EXISTS "Students and organizers can delete interview sessions" ON public.mock_interview_sessions;
CREATE POLICY "Students and organizers can delete interview sessions"
    ON public.mock_interview_sessions
    FOR DELETE TO authenticated
    USING (
        student_id = auth.uid()
        OR (SELECT public.is_staff())
        OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
    );

-- 6.2 Table Policies: mock_interview_turns
DROP POLICY IF EXISTS "Students can view own interview turns" ON public.mock_interview_turns;
DROP POLICY IF EXISTS "Students and organizers can view interview turns" ON public.mock_interview_turns;
CREATE POLICY "Students and organizers can view interview turns"
    ON public.mock_interview_turns
    FOR SELECT TO authenticated
    USING (
        session_id IN (SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid())
        OR (SELECT public.is_staff())
        OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
    );

DROP POLICY IF EXISTS "Students and organizers can delete interview turns" ON public.mock_interview_turns;
CREATE POLICY "Students and organizers can delete interview turns"
    ON public.mock_interview_turns
    FOR DELETE TO authenticated
    USING (
        session_id IN (SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid())
        OR (SELECT public.is_staff())
        OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
    );

-- 6.3 Table Policies: mock_interview_reports
DROP POLICY IF EXISTS "Students can view own interview reports" ON public.mock_interview_reports;
DROP POLICY IF EXISTS "Students and organizers can view interview reports" ON public.mock_interview_reports;
CREATE POLICY "Students and organizers can view interview reports"
    ON public.mock_interview_reports
    FOR SELECT TO authenticated
    USING (
        session_id IN (SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid())
        OR (SELECT public.is_staff())
        OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
    );

DROP POLICY IF EXISTS "Students and organizers can delete interview reports" ON public.mock_interview_reports;
CREATE POLICY "Students and organizers can delete interview reports"
    ON public.mock_interview_reports
    FOR DELETE TO authenticated
    USING (
        session_id IN (SELECT id FROM public.mock_interview_sessions WHERE student_id = auth.uid())
        OR (SELECT public.is_staff())
        OR (auth.jwt() ->> 'role') IN ('organizer', 'main_admin', 'sub_admin')
    );

