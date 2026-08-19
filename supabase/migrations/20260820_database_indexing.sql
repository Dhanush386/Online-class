-- ============================================================================
-- Learnova Hardening Pass — Section 7: Database Indexing & Query Performance
-- ============================================================================

-- 1. Assessment & Questions Indexing
CREATE INDEX IF NOT EXISTS idx_questions_assessment_id ON public.questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_submissions_assessment_student 
  ON public.assessment_submissions(assessment_id, student_id);

-- 2. Enrollments & Course Queries
CREATE INDEX IF NOT EXISTS idx_enrollments_student_course 
  ON public.enrollments(student_id, course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id 
  ON public.enrollments(course_id);

-- 3. Proctoring Telemetry & Violations
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_assessment_student 
  ON public.proctoring_sessions(assessment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_sessions_token 
  ON public.proctoring_sessions(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proctoring_violations_session 
  ON public.proctoring_violations(session_id);

-- 4. Live Classroom: Attendance, Chat & Polls
CREATE INDEX IF NOT EXISTS idx_live_attendance_video_student 
  ON public.live_attendance(video_id, student_id);
CREATE INDEX IF NOT EXISTS idx_live_poll_votes_poll_student 
  ON public.live_poll_votes(poll_id, student_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_messages_video_time 
  ON public.live_chat_messages(video_id, created_at DESC);

-- 5. Support & Progress Telemetry
CREATE INDEX IF NOT EXISTS idx_support_messages_student 
  ON public.support_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_student_course 
  ON public.progress(student_id, course_id);
