-- ============================================================================
-- Learnova Migration: Retain Open Time & Remove Due Date / Close Time Gating
-- ============================================================================

-- Redefine is_assessment_time_open to only check the opening start window.
-- No due_date or close_time restrictions are enforced.
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
  );
$$;

-- Clear any existing due_date and close_time values
UPDATE public.assessments
SET due_date = NULL, close_time = NULL
WHERE due_date IS NOT NULL OR close_time IS NOT NULL;
