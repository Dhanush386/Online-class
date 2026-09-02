-- ============================================================================
-- Learnova Hardening Pass — Strict Time-Gating Default Enforcement
-- ============================================================================

-- Replaces helper to eliminate unrestricted due_date NULL escape hatch
CREATE OR REPLACE FUNCTION public.is_assessment_time_open(target_assessment_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessments
    WHERE id = target_assessment_id 
      AND (open_time IS NULL OR open_time <= now() + interval '5 minutes')
      -- Enforces closing boundary: If due_date is explicitly set, must not be expired.
      -- If due_date was omitted by legacy data, defaults to 7 days from creation.
      AND COALESCE(due_date, created_at + interval '7 days') >= now()
  );
$$;
