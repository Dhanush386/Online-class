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

-- 1. Secure Server-Side Function: Start Exam Session & Issue Signed Token
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

  -- 5. Device signal verification
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

  -- 7. Insert active proctoring session
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

-- 2. Secure Server-Side Function: Grade & Submit Assessment with Token Validation
-- Scores are computed SERVER-SIDE directly against database questions to prevent score tampering.
CREATE OR REPLACE FUNCTION public.submit_assessment_with_token(
  p_assessment_id uuid,
  p_session_id uuid,
  p_session_token text,
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
  v_q RECORD;
  v_total_questions int := 0;
  v_computed_score int := 0;
  v_student_answer jsonb;
  v_student_selected text;
  v_student_selected_arr jsonb;
  v_correct_arr jsonb;
  v_is_correct boolean;
  v_evaluated_answers jsonb := '[]'::jsonb;
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

  -- 2. Server-side grading against ground-truth database questions
  FOR v_q IN (SELECT id, correct_answer FROM public.questions WHERE assessment_id = p_assessment_id) LOOP
    v_total_questions := v_total_questions + 1;
    v_is_correct := false;

    -- Extract student answer for this question from p_answers json array
    SELECT elem INTO v_student_answer
    FROM jsonb_array_elements(p_answers) elem
    WHERE (elem->>'question_id')::uuid = v_q.id
    LIMIT 1;

    IF v_student_answer IS NOT NULL THEN
      -- Handle array of correct answers (multi-choice) vs single string
      IF v_q.correct_answer ~ '^\[' THEN
        v_correct_arr := v_q.correct_answer::jsonb;
      ELSE
        v_correct_arr := jsonb_build_array(v_q.correct_answer);
      END IF;

      -- Check if student selected an array or single value
      IF jsonb_typeof(v_student_answer->'selected_option') = 'array' THEN
        v_student_selected_arr := v_student_answer->'selected_option';
        IF v_correct_arr = v_student_selected_arr THEN
          v_is_correct := true;
        END IF;
      ELSE
        v_student_selected := v_student_answer->>'selected_option';
        IF v_correct_arr ? v_student_selected THEN
          v_is_correct := true;
        END IF;
      END IF;
    END IF;

    IF v_is_correct THEN
      v_computed_score := v_computed_score + 1;
    END IF;

    v_evaluated_answers := v_evaluated_answers || jsonb_build_object(
      'question_id', v_q.id,
      'selected_option', COALESCE(v_student_answer->'selected_option', 'null'::jsonb),
      'is_correct', v_is_correct
    );
  END LOOP;

  IF v_total_questions = 0 THEN
    v_total_questions := 1;
  END IF;

  -- 3. Insert finalized submission with server-computed score
  INSERT INTO public.assessment_submissions (
    assessment_id,
    student_id,
    score,
    total_questions,
    answers
  ) VALUES (
    p_assessment_id,
    v_student_id,
    v_computed_score,
    v_total_questions,
    v_evaluated_answers
  );

  -- 4. Mark proctoring session completed and invalidate token
  UPDATE public.proctoring_sessions
  SET 
    status = 'completed',
    end_time = now(),
    session_token = NULL
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'score', v_computed_score,
    'total', v_total_questions,
    'percentage', ROUND((v_computed_score::numeric / v_total_questions) * 100)
  );
END;
$$;
