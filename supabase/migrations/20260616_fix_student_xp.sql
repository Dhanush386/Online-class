-- Fix XP calculation to only count the highest score per challenge/assessment instead of summing all attempts
CREATE OR REPLACE FUNCTION public.calculate_student_xp(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_coding_xp INTEGER;
    v_assess_xp INTEGER;
BEGIN
    -- Sum MAX accepted coding submissions per challenge
    SELECT COALESCE(SUM(max_score), 0) INTO v_coding_xp
    FROM (
        SELECT MAX(score) as max_score
        FROM public.coding_submissions
        WHERE student_id = p_student_id AND status = 'accepted'
        GROUP BY challenge_id
    ) as coding_max;

    -- Sum MAX assessment submissions per assessment
    SELECT COALESCE(SUM(max_score), 0) INTO v_assess_xp
    FROM (
        SELECT MAX(score) as max_score
        FROM public.assessment_submissions
        WHERE student_id = p_student_id
        GROUP BY assessment_id
    ) as assess_max;

    RETURN v_coding_xp + v_assess_xp;
END;
$$;

-- Backfill and fix XP for all existing students
UPDATE public.users u
SET xp = public.calculate_student_xp(u.id)
WHERE u.role = 'student';
