-- ============================================================================
-- Learnova Hardening Pass — Section 1: Comprehensive RLS & Integrity Hardening
-- ============================================================================

-- 1. Helper function: Strict Administrator Check (main_admin & sub_admin only)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('main_admin', 'sub_admin')
  );
$$;

-- 2. Helper function: Main Administrator Check (Root authority)
CREATE OR REPLACE FUNCTION public.is_main_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'main_admin'
  );
$$;

-- 3. Helper function: Staff Check (Admin OR Course Instructor/Organizer)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('main_admin', 'sub_admin', 'organizer')
  );
$$;

-- 4. Helper function: Check if user owns or is assigned to a course
CREATE OR REPLACE FUNCTION public.is_organizer_for_course(target_course_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses
    WHERE id = target_course_id AND (created_by = auth.uid() OR public.is_admin())
  );
$$;

-- 5. Helper function: Check active student enrollment
CREATE OR REPLACE FUNCTION public.is_enrolled(target_course_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments
    WHERE course_id = target_course_id AND student_id = auth.uid()
  );
$$;

-- 6. Helper function: Check if an assessment is within BOTH its start and closing time windows
CREATE OR REPLACE FUNCTION public.is_assessment_time_open(target_assessment_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessments
    WHERE id = target_assessment_id 
      AND (scheduled_date IS NULL OR scheduled_date <= now() + interval '5 minutes')
      AND (due_date IS NULL OR due_date >= now())
  );
$$;

-- ============================================================================
-- INTEGRITY: ATTEMPT & VOTE UNIQUE CONSTRAINTS
-- ============================================================================
-- 1. Prevent duplicate submissions per assessment per student at DB level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_assessment_student_attempt'
  ) THEN
    ALTER TABLE public.assessment_submissions 
    ADD CONSTRAINT uq_assessment_student_attempt UNIQUE (assessment_id, student_id);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- 2. Prevent duplicate votes per poll per user at DB level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_live_poll_user_vote'
  ) THEN
    ALTER TABLE public.live_poll_votes 
    ADD CONSTRAINT uq_live_poll_user_vote UNIQUE (poll_id, user_id);
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- ============================================================================
-- 1. USERS & PROFILES
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy" ON public.users
  FOR SELECT USING (
    id = auth.uid() 
    OR public.is_staff()
    OR role IN ('organizer', 'main_admin', 'sub_admin')
    OR (role = 'student' AND auth.uid() IS NOT NULL)
  );

DROP POLICY IF EXISTS "users_update_policy" ON public.users;
CREATE POLICY "users_update_policy" ON public.users
  FOR UPDATE USING (
    id = auth.uid() OR public.is_admin()
  ) WITH CHECK (
    (id = auth.uid() AND role = (SELECT role FROM public.users WHERE id = auth.uid()))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "student_profiles_select" ON public.student_profiles;
CREATE POLICY "student_profiles_select" ON public.student_profiles
  FOR SELECT USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "student_profiles_upsert" ON public.student_profiles;
CREATE POLICY "student_profiles_upsert" ON public.student_profiles
  FOR ALL USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- ============================================================================
-- 2. COURSES & ENROLLMENTS
-- ============================================================================
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "courses_select" ON public.courses;
CREATE POLICY "courses_select" ON public.courses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "courses_manage" ON public.courses;
CREATE POLICY "courses_manage" ON public.courses
  FOR ALL USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "enrollments_select" ON public.enrollments;
CREATE POLICY "enrollments_select" ON public.enrollments
  FOR SELECT USING (
    student_id = auth.uid() 
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "enrollments_manage" ON public.enrollments;
CREATE POLICY "enrollments_manage" ON public.enrollments
  FOR ALL USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- ============================================================================
-- 3. ASSESSMENTS, TIME-GATED QUESTIONS & SUBMISSION POLICIES
-- ============================================================================
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assessments_select" ON public.assessments;
CREATE POLICY "assessments_select" ON public.assessments
  FOR SELECT USING (
    public.is_staff() 
    OR public.is_enrolled(course_id)
  );

DROP POLICY IF EXISTS "assessments_manage" ON public.assessments;
CREATE POLICY "assessments_manage" ON public.assessments
  FOR ALL USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- TIME-GATED EXAM QUESTIONS (Enrolled students within active start & due dates)
DROP POLICY IF EXISTS "assessment_questions_select" ON public.assessment_questions;
CREATE POLICY "assessment_questions_select" ON public.assessment_questions
  FOR SELECT USING (
    public.is_staff() 
    OR (
      EXISTS (
        SELECT 1 FROM public.assessments a 
        WHERE a.id = assessment_questions.assessment_id AND public.is_enrolled(a.course_id)
      )
      AND public.is_assessment_time_open(assessment_id)
    )
  );

DROP POLICY IF EXISTS "assessment_questions_manage" ON public.assessment_questions;
CREATE POLICY "assessment_questions_manage" ON public.assessment_questions
  FOR ALL USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "assessment_submissions_select" ON public.assessment_submissions;
CREATE POLICY "assessment_submissions_select" ON public.assessment_submissions
  FOR SELECT USING (
    student_id = auth.uid() 
    OR public.is_staff()
  );

-- SUBMISSION INSERT POLICY (Enforces student ownership + open time window + enrollment)
DROP POLICY IF EXISTS "assessment_submissions_insert" ON public.assessment_submissions;
CREATE POLICY "assessment_submissions_insert" ON public.assessment_submissions
  FOR INSERT WITH CHECK (
    (
      student_id = auth.uid() 
      AND public.is_assessment_time_open(assessment_id)
      AND EXISTS (
        SELECT 1 FROM public.assessments a 
        WHERE a.id = assessment_submissions.assessment_id AND public.is_enrolled(a.course_id)
      )
    )
    OR public.is_admin()
  );

-- Explicitly block UPDATE on submissions so answers cannot be modified post-submission
DROP POLICY IF EXISTS "assessment_submissions_update" ON public.assessment_submissions;
CREATE POLICY "assessment_submissions_update" ON public.assessment_submissions
  FOR UPDATE USING (public.is_admin());

-- ============================================================================
-- 4. PROCTORING SESSIONS & VIOLATIONS
-- ============================================================================
ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proctoring_sessions_select" ON public.proctoring_sessions;
CREATE POLICY "proctoring_sessions_select" ON public.proctoring_sessions
  FOR SELECT USING (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "proctoring_sessions_insert" ON public.proctoring_sessions;
CREATE POLICY "proctoring_sessions_insert" ON public.proctoring_sessions
  FOR INSERT WITH CHECK (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "proctoring_sessions_update" ON public.proctoring_sessions;
CREATE POLICY "proctoring_sessions_update" ON public.proctoring_sessions
  FOR UPDATE USING (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "proctoring_violations_select" ON public.proctoring_violations;
CREATE POLICY "proctoring_violations_select" ON public.proctoring_violations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.proctoring_sessions ps 
      WHERE ps.id = proctoring_violations.session_id AND (ps.student_id = auth.uid() OR public.is_staff())
    )
  );

DROP POLICY IF EXISTS "proctoring_violations_insert" ON public.proctoring_violations;
CREATE POLICY "proctoring_violations_insert" ON public.proctoring_violations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.proctoring_sessions ps 
      WHERE ps.id = proctoring_violations.session_id AND (ps.student_id = auth.uid() OR public.is_staff())
    )
  );

-- ============================================================================
-- 5. LIVE ATTENDANCE, NOTES, POLLS & CHAT
-- ============================================================================
ALTER TABLE public.live_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_attendance_select" ON public.live_attendance;
CREATE POLICY "live_attendance_select" ON public.live_attendance
  FOR SELECT USING (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "live_attendance_upsert" ON public.live_attendance;
CREATE POLICY "live_attendance_upsert" ON public.live_attendance
  FOR ALL USING (student_id = auth.uid() OR public.is_staff())
  WITH CHECK (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "live_notes_owner" ON public.live_class_notes;
CREATE POLICY "live_notes_owner" ON public.live_class_notes
  FOR ALL USING (user_id = auth.uid() OR student_id = auth.uid())
  WITH CHECK (user_id = auth.uid() OR student_id = auth.uid());

DROP POLICY IF EXISTS "live_chat_select" ON public.live_chat_messages;
CREATE POLICY "live_chat_select" ON public.live_chat_messages
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "live_chat_insert" ON public.live_chat_messages;
CREATE POLICY "live_chat_insert" ON public.live_chat_messages
  FOR INSERT WITH CHECK (user_id = auth.uid() OR sender_id = auth.uid());

DROP POLICY IF EXISTS "live_chat_reactions_all" ON public.live_chat_reactions;
CREATE POLICY "live_chat_reactions_all" ON public.live_chat_reactions
  FOR ALL USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "live_polls_select" ON public.live_polls;
CREATE POLICY "live_polls_select" ON public.live_polls
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "live_polls_manage" ON public.live_polls;
CREATE POLICY "live_polls_manage" ON public.live_polls
  FOR ALL USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "live_poll_votes_all" ON public.live_poll_votes;
CREATE POLICY "live_poll_votes_all" ON public.live_poll_votes
  FOR ALL USING (user_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

-- ============================================================================
-- 6. CODING CHALLENGES, SUBMISSIONS & DISCUSSIONS
-- ============================================================================
ALTER TABLE public.coding_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_discussion_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coding_challenges_select" ON public.coding_challenges;
CREATE POLICY "coding_challenges_select" ON public.coding_challenges
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "coding_challenges_manage" ON public.coding_challenges;
CREATE POLICY "coding_challenges_manage" ON public.coding_challenges
  FOR ALL USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "coding_submissions_select" ON public.coding_submissions;
CREATE POLICY "coding_submissions_select" ON public.coding_submissions
  FOR SELECT USING (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "coding_submissions_insert" ON public.coding_submissions;
CREATE POLICY "coding_submissions_insert" ON public.coding_submissions
  FOR INSERT WITH CHECK (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "coding_discussions_all" ON public.coding_discussions;
CREATE POLICY "coding_discussions_all" ON public.coding_discussions
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "coding_discussion_replies_all" ON public.coding_discussion_replies;
CREATE POLICY "coding_discussion_replies_all" ON public.coding_discussion_replies
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (user_id = auth.uid() OR public.is_staff());

-- ============================================================================
-- 7. PROGRESS, HEALTH & AI RECOMMENDATIONS
-- ============================================================================
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_week_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progress_all" ON public.progress;
CREATE POLICY "progress_all" ON public.progress
  FOR ALL USING (student_id = auth.uid() OR public.is_staff())
  WITH CHECK (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "video_progress_all" ON public.video_progress;
CREATE POLICY "video_progress_all" ON public.video_progress
  FOR ALL USING (student_id = auth.uid() OR public.is_staff())
  WITH CHECK (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "student_week_progress_all" ON public.student_week_progress;
CREATE POLICY "student_week_progress_all" ON public.student_week_progress
  FOR ALL USING (student_id = auth.uid() OR public.is_staff())
  WITH CHECK (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "learning_health_all" ON public.learning_health_history;
CREATE POLICY "learning_health_all" ON public.learning_health_history
  FOR ALL USING (student_id = auth.uid() OR public.is_staff())
  WITH CHECK (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "learning_mastery_all" ON public.learning_mastery;
CREATE POLICY "learning_mastery_all" ON public.learning_mastery
  FOR ALL USING (student_id = auth.uid() OR public.is_staff())
  WITH CHECK (student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "ai_recommendations_all" ON public.ai_recommendations;
CREATE POLICY "ai_recommendations_all" ON public.ai_recommendations
  FOR ALL USING (student_id = auth.uid() OR public.is_staff())
  WITH CHECK (student_id = auth.uid() OR public.is_staff());

-- ============================================================================
-- 8. SUPPORT TICKETS & STRICT ADMIN-ONLY INVITES
-- ============================================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_all" ON public.support_tickets;
CREATE POLICY "support_tickets_all" ON public.support_tickets
  FOR ALL USING (user_id = auth.uid() OR student_id = auth.uid() OR public.is_staff())
  WITH CHECK (user_id = auth.uid() OR student_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "support_messages_all" ON public.support_messages;
CREATE POLICY "support_messages_all" ON public.support_messages
  FOR ALL USING (
    sender_id = auth.uid() 
    OR public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = support_messages.ticket_id AND (st.user_id = auth.uid() OR st.student_id = auth.uid())
    )
  )
  WITH CHECK (sender_id = auth.uid() OR public.is_staff());

-- STRICT PRIVILEGE GATE: Only true Administrators (main_admin / sub_admin) can manage organizer invites
DROP POLICY IF EXISTS "organizer_invites_admin" ON public.organizer_invites;
CREATE POLICY "organizer_invites_admin" ON public.organizer_invites
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());
