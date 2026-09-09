-- Fix start_exam_session to not require pgcrypto gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_student_id uuid := auth.uid();
  v_duration int := 30;
  v_session_id uuid;
  v_session_token text;
  v_expires_at timestamptz;
BEGIN
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(duration, 30)
  INTO v_duration
  FROM public.assessments
  WHERE id = p_assessment_id;

  -- 100% native token generation without relying on external extensions
  v_session_token := md5(random()::text || clock_timestamp()::text) || md5(gen_random_uuid()::text);
  v_expires_at := now() + (COALESCE(v_duration, 30) * interval '1 minute') + interval '15 minutes';

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
