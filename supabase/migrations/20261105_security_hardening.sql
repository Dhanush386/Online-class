-- Security hardening: prevent students from reading answer keys through PostgREST.
-- Students receive only the fields required to render the assessment. Staff retain
-- direct access to the full questions table through the existing questions_manage policy.

DROP POLICY IF EXISTS "questions_select" ON public.questions;
CREATE POLICY "questions_select" ON public.questions
  FOR SELECT USING (public.is_staff());

CREATE OR REPLACE FUNCTION public.get_assessment_questions(p_assessment_id uuid)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_course_id uuid;
  v_is_staff boolean := public.is_staff();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT course_id INTO v_course_id
  FROM public.assessments
  WHERE id = p_assessment_id;

  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Assessment not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_is_staff THEN
    IF NOT public.is_enrolled(v_course_id) THEN
      RAISE EXCEPTION 'You are not enrolled in this course' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_assessment_time_open(p_assessment_id) THEN
      RAISE EXCEPTION 'Assessment is not currently open' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
  SELECT jsonb_build_object(
    'id', q.id,
    'question_text', q.question_text,
    'options', to_jsonb(q.options),
    'image_url', q.image_url,
    'question_type', q.question_type,
    'code_snippet', q.code_snippet,
    'code_language', q.code_language,
    'snippet_title', q.snippet_title,
    'is_multi_select',
      CASE
        WHEN left(ltrim(COALESCE(q.correct_answer, '')), 1) = '['
          AND jsonb_typeof(q.correct_answer::jsonb) = 'array'
        THEN jsonb_array_length(q.correct_answer::jsonb) > 1
        ELSE false
      END
  )
  FROM public.questions q
  WHERE q.assessment_id = p_assessment_id
  ORDER BY q.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_assessment_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_assessment_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_assessment_questions(uuid) TO authenticated;

-- Replace server-side grading so multi-select answers are compared as sets,
-- not ordered JSON arrays. Duplicate submitted selections are rejected.
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

  IF jsonb_typeof(p_answers) <> 'array' THEN
    RAISE EXCEPTION 'Answers must be a JSON array' USING ERRCODE = '22023';
  END IF;

  SELECT true INTO v_session_valid
  FROM public.proctoring_sessions
  WHERE id = p_session_id
    AND student_id = v_student_id
    AND assessment_id = p_assessment_id
    AND session_token = p_session_token
    AND expires_at >= now()
    AND status = 'active';

  IF NOT COALESCE(v_session_valid, false) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Invalid or expired exam session token' USING ERRCODE = '42501';
  END IF;

  FOR v_q IN (
    SELECT id, correct_answer
    FROM public.questions
    WHERE assessment_id = p_assessment_id
  ) LOOP
    v_total_questions := v_total_questions + 1;
    v_is_correct := false;
    v_student_answer := NULL;

    SELECT elem INTO v_student_answer
    FROM jsonb_array_elements(p_answers) elem
    WHERE (elem->>'question_id')::uuid = v_q.id
    LIMIT 1;

    IF v_student_answer IS NOT NULL THEN
      IF left(ltrim(COALESCE(v_q.correct_answer, '')), 1) = '[' THEN
        v_correct_arr := v_q.correct_answer::jsonb;
      ELSE
        v_correct_arr := jsonb_build_array(v_q.correct_answer);
      END IF;

      IF jsonb_typeof(v_correct_arr) <> 'array' THEN
        RAISE EXCEPTION 'Invalid answer key for question %', v_q.id;
      END IF;

      IF jsonb_typeof(v_student_answer->'selected_option') = 'array' THEN
        v_student_selected_arr := v_student_answer->'selected_option';

        IF jsonb_array_length(v_student_selected_arr) = jsonb_array_length(v_correct_arr)
          AND (
            SELECT count(DISTINCT value)
            FROM jsonb_array_elements_text(v_student_selected_arr) AS selected(value)
          ) = jsonb_array_length(v_student_selected_arr)
          AND NOT EXISTS (
            SELECT value FROM jsonb_array_elements_text(v_correct_arr) AS correct(value)
            EXCEPT
            SELECT value FROM jsonb_array_elements_text(v_student_selected_arr) AS selected(value)
          )
          AND NOT EXISTS (
            SELECT value FROM jsonb_array_elements_text(v_student_selected_arr) AS selected(value)
            EXCEPT
            SELECT value FROM jsonb_array_elements_text(v_correct_arr) AS correct(value)
          )
        THEN
          v_is_correct := true;
        END IF;
      ELSE
        v_student_selected := v_student_answer->>'selected_option';
        IF jsonb_typeof(v_correct_arr) = 'array' AND v_correct_arr ? v_student_selected THEN
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

  INSERT INTO public.assessment_submissions (
    assessment_id, student_id, score, total_questions, answers
  ) VALUES (
    p_assessment_id, v_student_id, v_computed_score, v_total_questions, v_evaluated_answers
  );

  UPDATE public.proctoring_sessions
  SET status = 'completed', end_time = now(), session_token = NULL
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'score', v_computed_score,
    'total', v_total_questions,
    'percentage', ROUND((v_computed_score::numeric / v_total_questions) * 100)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_assessment_with_token(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_assessment_with_token(uuid, uuid, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment_with_token(uuid, uuid, text, jsonb) TO authenticated;
