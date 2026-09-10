-- ============================================================================
-- Learnova Enterprise Security Hardening Pass
-- Migration: 20260910_security_auth_hardening.sql
-- Covers:
-- 1. Anti-Privilege Escalation Trigger on auth.users -> public.users
-- 2. Database-level Role Immutability on public.users
-- 3. Strict Admin-only RLS on organizer_invites
-- 4. Unified Anti-Abuse Rate Limiting Engine & Lockout Protection
-- 5. Append-only Security Audit Logging
-- ============================================================================

-- ── 1. UNIFIED RATE LIMITING & LOCKOUT ENGINE ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL, -- Normalized email, user ID, or server-verified IP
  action text NOT NULL,      -- 'login', 'register', 'ai_request', 'otp'
  attempt_count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  CONSTRAINT uq_security_rate_limit_id_action UNIQUE (identifier, action)
);

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limiter function (executable by public / anon during login & registration)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier text,
  p_action text,
  p_max_attempts int DEFAULT 5,
  p_window_seconds int DEFAULT 900, -- 15 minutes default
  p_lockout_seconds int DEFAULT 900  -- 15 minutes lockout default
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_norm_id text := LOWER(TRIM(p_identifier));
  v_rec RECORD;
  v_now timestamptz := now();
BEGIN
  IF v_norm_id IS NULL OR v_norm_id = '' OR p_action IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'message', 'Invalid request parameters.');
  END IF;

  SELECT * INTO v_rec
  FROM public.security_rate_limits
  WHERE identifier = v_norm_id AND action = p_action;

  IF v_rec IS NULL THEN
    INSERT INTO public.security_rate_limits (identifier, action, attempt_count, window_start)
    VALUES (v_norm_id, p_action, 1, v_now)
    ON CONFLICT (identifier, action) DO UPDATE
    SET attempt_count = security_rate_limits.attempt_count + 1;

    RETURN jsonb_build_object('allowed', true);
  END IF;

  -- Check if currently under active lockout
  IF v_rec.locked_until IS NOT NULL AND v_rec.locked_until > v_now THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'locked', true,
      'retry_after_seconds', CEIL(EXTRACT(EPOCH FROM (v_rec.locked_until - v_now))),
      'message', 'Too many attempts. Account access is temporarily locked for security. Please try again later.'
    );
  END IF;

  -- Check if time window has expired
  IF EXTRACT(EPOCH FROM (v_now - v_rec.window_start)) > p_window_seconds THEN
    -- Reset window
    UPDATE public.security_rate_limits
    SET attempt_count = 1, window_start = v_now, locked_until = NULL
    WHERE identifier = v_norm_id AND action = p_action;

    RETURN jsonb_build_object('allowed', true);
  ELSE
    -- Inside existing window
    IF v_rec.attempt_count >= p_max_attempts THEN
      -- Trigger lockout
      UPDATE public.security_rate_limits
      SET locked_until = v_now + (p_lockout_seconds || ' seconds')::interval
      WHERE identifier = v_norm_id AND action = p_action;

      RETURN jsonb_build_object(
        'allowed', false,
        'locked', true,
        'retry_after_seconds', p_lockout_seconds,
        'message', 'Too many failed attempts. Access is locked for 15 minutes.'
      );
    ELSE
      UPDATE public.security_rate_limits
      SET attempt_count = attempt_count + 1
      WHERE identifier = v_norm_id AND action = p_action;

      RETURN jsonb_build_object('allowed', true);
    END IF;
  END IF;
END;
$$;

-- Reset failed attempt counter upon successful authentication
CREATE OR REPLACE FUNCTION public.record_successful_auth(
  p_identifier text,
  p_action text DEFAULT 'login'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM public.security_rate_limits
  WHERE identifier = LOWER(TRIM(p_identifier)) AND action = p_action;
END;
$$;


-- ── 2. SECURITY AUDIT LOGGING ENGINE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'critical')),
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Append-only audit logs: Only administrators can view audit logs
DROP POLICY IF EXISTS "security_audit_logs_admin_select" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_admin_select" ON public.security_audit_logs
  FOR SELECT USING (public.is_admin());

-- Disallow public or user direct modifications/deletions of audit logs
DROP POLICY IF EXISTS "security_audit_logs_deny_update" ON public.security_audit_logs;
DROP POLICY IF EXISTS "security_audit_logs_deny_delete" ON public.security_audit_logs;

-- Log security event RPC
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_severity text DEFAULT 'info',
  p_details jsonb DEFAULT '{}'::jsonb,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.security_audit_logs (
    user_id,
    event_type,
    severity,
    details,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    p_event_type,
    p_severity,
    p_details,
    p_ip,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;


-- ── 3. STRICT PRIVILEGE ESCALATION FIX IN handle_new_user ────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_default_role CONSTANT text := 'student';
  v_requested_role text := COALESCE(new.raw_user_meta_data->>'role', v_default_role);
  v_final_role text := v_default_role;
  v_final_status text := 'pending';
  v_invite_match RECORD;
  v_clean_email text := LOWER(TRIM(new.email));
BEGIN
  -- If user attempts to register as organizer or admin, strictly verify invite
  IF v_requested_role IN ('organizer', 'sub_admin', 'main_admin') THEN
    SELECT * INTO v_invite_match
    FROM public.organizer_invites
    WHERE LOWER(TRIM(email)) = v_clean_email;

    IF v_invite_match IS NOT NULL THEN
      -- Validate role matches invite or defaults to organizer
      IF v_invite_match.role = v_requested_role OR (v_requested_role = 'organizer' AND (v_invite_match.role IS NULL OR v_invite_match.role = 'organizer')) THEN
        v_final_role := v_requested_role;
        v_final_status := 'approved';

        -- Consume the invite record atomically
        DELETE FROM public.organizer_invites WHERE LOWER(TRIM(email)) = v_clean_email;
      ELSE
        -- Role mismatch on invite: log security anomaly and force student
        PERFORM public.log_security_event(
          'privilege_escalation_attempt',
          'critical',
          jsonb_build_object(
            'email', v_clean_email,
            'requested_role', v_requested_role,
            'invited_role', v_invite_match.role,
            'reason', 'Requested role does not match invite'
          )
        );
        v_final_role := v_default_role;
        v_final_status := 'pending';
      END IF;
    ELSE
      -- No invite exists: Potential privilege escalation attack.
      -- Log security alert and FORCE student role.
      PERFORM public.log_security_event(
        'unauthorized_admin_registration_attempt',
        'critical',
        jsonb_build_object(
          'email', v_clean_email,
          'attempted_role', v_requested_role,
          'reason', 'No matching invite record in organizer_invites'
        )
      );
      v_final_role := v_default_role;
      v_final_status := 'pending';
    END IF;
  ELSE
    -- Standard student registration
    v_final_role := v_default_role;
    v_final_status := 'approved'; -- Students approved by default
  END IF;

  -- Persist profile to public.users.
  -- CRITICAL: On conflict, NEVER update the role column from user metadata!
  INSERT INTO public.users (id, name, email, role, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    new.email,
    v_final_role,
    v_final_status
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email;
    -- role and status are deliberately excluded to prevent post-signup metadata escalation

  RETURN new;
END;
$$;

-- Ensure trigger is active on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 4. DATABASE-LEVEL ROLE IMMUTABILITY TRIGGER ON public.users ───────────────

CREATE OR REPLACE FUNCTION public.enforce_users_role_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- If role is changing
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Only main_admin has root authority to change roles
    IF NOT public.is_main_admin() THEN
      RAISE EXCEPTION 'Access Denied: Only main administrators are permitted to modify user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_users_role_immutability ON public.users;
CREATE TRIGGER trg_enforce_users_role_immutability
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_users_role_immutability();


-- ── 5. STRICT RLS HARDENING ON organizer_invites ─────────────────────────────

ALTER TABLE public.organizer_invites ENABLE ROW LEVEL SECURITY;

-- Drop any existing overly permissive policies
DROP POLICY IF EXISTS "organizer_invites_admin" ON public.organizer_invites;
DROP POLICY IF EXISTS "Organizers can manage invites" ON public.organizer_invites;
DROP POLICY IF EXISTS "Anyone can check their own invite" ON public.organizer_invites;

-- Only verified admins may read, insert, update, or delete invites
CREATE POLICY "organizer_invites_admin_manage" ON public.organizer_invites
  FOR ALL USING (
    public.is_admin()
  )
  WITH CHECK (
    -- Main admin can invite any role; sub_admin can only invite organizers
    public.is_main_admin() 
    OR (public.is_admin() AND role = 'organizer')
  );

-- Secure RPC to verify an invite for registration without exposing table data to unauthenticated scraping
CREATE OR REPLACE FUNCTION public.check_organizer_invite(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_rec RECORD;
  v_clean text := LOWER(TRIM(p_email));
BEGIN
  IF v_clean IS NULL OR v_clean = '' THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  SELECT role INTO v_rec
  FROM public.organizer_invites
  WHERE LOWER(TRIM(email)) = v_clean;

  IF v_rec IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', true,
      'role', COALESCE(v_rec.role, 'organizer')
    );
  END IF;

  RETURN jsonb_build_object('valid', false);
END;
$$;

NOTIFY pgrst, 'reload schema';
