-- ============================================================================
-- Learnova Hardening Pass — Section 2: Server-Side Exam & Device Validation
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'proctoring_sessions' AND column_name = 'session_token'
  ) THEN
    ALTER TABLE public.proctoring_sessions 
    ADD COLUMN session_token text,
    ADD COLUMN client_user_agent text,
    ADD COLUMN viewport_width int,
    ADD COLUMN viewport_height int,
    ADD COLUMN is_device_validated boolean DEFAULT false,
    ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.start_exam_session(
  p_assessment_id uuid,
  p_user_agent text,
  p_viewport_width int,
  p_viewport_height int,
  p_touch_points int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_course_id uuid;
  v_duration int := 30;
  v_session_id uuid;
  v_session_token text;
  v_expires_at timestamptz;
  v_is_mobile boolean := false;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- 1. Get assessment details
  SELECT course_id, COALESCE(duration, 30)
  INTO v_course_id, v_duration
  FROM public.assessments
  WHERE id = p_assessment_id;

  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Assessment not found' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Verify active enrollment
  IF NOT public.is_enrolled(v_course_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Student is not enrolled in this course' USING ERRCODE = '42501';
  END IF;

  -- 3. Verify open time window
  IF NOT public.is_assessment_time_open(p_assessment_id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Assessment is not currently open' USING ERRCODE = '42501';
  END IF;

  -- 4. Verify single attempt constraint
  IF EXISTS (
    SELECT 1 FROM public.assessment_submissions 
    WHERE assessment_id = p_assessment_id AND student_id = v_student_id
  ) THEN
    RAISE EXCEPTION 'Assessment attempt limit reached' USING ERRCODE = '23505';
  END IF;

  -- 5. Server-side device and viewport validation
  IF p_viewport_width < 1024 
     OR p_user_agent ~* '(Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile)'
     OR p_touch_points > 5 THEN
    v_is_mobile := true;
  END IF;

  IF v_is_mobile AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Mobile devices are blocked. Proctored exams must be taken on a desktop or laptop computer.' USING ERRCODE = '22023';
  END IF;

  -- 6. Generate crypto session token & expiration
  v_session_token := encode(gen_random_bytes(32), 'hex');
  v_expires_at := now() + (v_duration * interval '1 minute') + interval '15 minutes';

  -- 7. Insert or update active proctoring session
  INSERT INTO public.proctoring_sessions (
    student_id,
    assessment_id,
    session_token,
    client_user_agent,
    viewport_width,
    viewport_height,
    is_device_validated,
    expires_at,
    status
  ) VALUES (
    v_student_id,
    p_assessment_id,
    v_session_token,
    p_user_agent,
    p_viewport_width,
    p_viewport_height,
    true,
    v_expires_at,
    'active'
  )
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'sessionId', v_session_id,
    'sessionToken', v_session_token,
    'expiresAt', v_expires_at,
    'deviceValidated', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_assessment_with_token(
  p_assessment_id uuid,
  p_session_id uuid,
  p_session_token text,
  p_score numeric,
  p_total_questions int,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_session_valid boolean := false;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- 1. Validate session token and expiration
  SELECT true INTO v_session_valid
  FROM public.proctoring_sessions
  WHERE id = p_session_id 
    AND student_id = v_student_id 
    AND assessment_id = p_assessment_id
    AND session_token = p_session_token
    AND expires_at >= now()
    AND status = 'active';

  IF NOT v_session_valid AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Invalid or expired exam session token' USING ERRCODE = '42501';
  END IF;

  -- 2. Insert finalized submission
  INSERT INTO public.assessment_submissions (
    assessment_id,
    student_id,
    score,
    total_questions,
    answers
  ) VALUES (
    p_assessment_id,
    v_student_id,
    p_score,
    p_total_questions,
    p_answers
  );

  -- 3. Mark proctoring session completed
  UPDATE public.proctoring_sessions
  SET 
    status = 'completed',
    end_time = now(),
    session_token = NULL
  WHERE id = p_session_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
