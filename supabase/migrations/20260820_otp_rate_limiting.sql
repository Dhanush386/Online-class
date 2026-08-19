-- ============================================================================
-- Learnova Hardening Pass — Section 3: OTP Rate Limiting
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- normalized email or hashed IP
  send_count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_otp_rate_limit_identifier UNIQUE (identifier)
);

ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow public execution of the rate limiter RPC
CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(
  p_email text,
  p_max_per_hour int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized text := LOWER(TRIM(p_email));
  v_limit_record RECORD;
  v_now timestamptz := now();
  v_window_seconds int := 3600; -- 1 hour
BEGIN
  IF v_normalized IS NULL OR v_normalized = '' THEN
    RETURN jsonb_build_object('allowed', false, 'message', 'Invalid request.');
  END IF;

  SELECT * INTO v_limit_record
  FROM public.otp_rate_limits
  WHERE identifier = v_normalized;

  IF v_limit_record IS NULL THEN
    -- First send in window
    INSERT INTO public.otp_rate_limits (identifier, send_count, window_start)
    VALUES (v_normalized, 1, v_now)
    ON CONFLICT (identifier) DO UPDATE
    SET send_count = otp_rate_limits.send_count + 1;

    RETURN jsonb_build_object('allowed', true);
  ELSE
    -- Check if 1 hour has elapsed
    IF EXTRACT(EPOCH FROM (v_now - v_limit_record.window_start)) > v_window_seconds THEN
      -- Reset window
      UPDATE public.otp_rate_limits
      SET send_count = 1, window_start = v_now
      WHERE identifier = v_normalized;

      RETURN jsonb_build_object('allowed', true);
    ELSE
      -- Inside existing window
      IF v_limit_record.send_count >= p_max_per_hour THEN
        -- Non-revealing error message
        RETURN jsonb_build_object(
          'allowed', false, 
          'message', 'Too many requests. Please wait before requesting another verification code.'
        );
      ELSE
        UPDATE public.otp_rate_limits
        SET send_count = send_count + 1
        WHERE identifier = v_normalized;

        RETURN jsonb_build_object('allowed', true);
      END IF;
    END IF;
  END IF;
END;
$$;
