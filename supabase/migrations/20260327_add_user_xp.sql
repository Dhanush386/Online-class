-- Migration: Add XP to users table and sync via triggers
-- Path: supabase/migrations/20260327_add_user_xp.sql

-- 1. Add xp column to users if it doesn't exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0;

-- 2. Create function to calculate total XP for a student
CREATE OR REPLACE FUNCTION public.calculate_student_xp(p_student_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_coding_xp INTEGER;
    v_assess_xp INTEGER;
BEGIN
    -- Sum accepted coding submissions
    SELECT COALESCE(SUM(score), 0) INTO v_coding_xp
    FROM public.coding_submissions
    WHERE student_id = p_student_id AND status = 'accepted';

    -- Sum assessment submissions
    SELECT COALESCE(SUM(score), 0) INTO v_assess_xp
    FROM public.assessment_submissions
    WHERE student_id = p_student_id;

    RETURN v_coding_xp + v_assess_xp;
END;
$$;

-- 3. Create trigger function to update user XP
CREATE OR REPLACE FUNCTION public.trigger_update_user_xp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the users table with the new calculated XP
    -- NEW/OLD depends on table, but student_id is always available
    IF TG_OP = 'DELETE' THEN
        UPDATE public.users 
        SET xp = public.calculate_student_xp(OLD.student_id)
        WHERE id = OLD.student_id;
        RETURN OLD;
    ELSE
        UPDATE public.users 
        SET xp = public.calculate_student_xp(NEW.student_id)
        WHERE id = NEW.student_id;
        RETURN NEW;
    END IF;
END;
$$;

-- 4. Set up triggers for coding_submissions
DROP TRIGGER IF EXISTS on_coding_submission_change ON public.coding_submissions;
CREATE TRIGGER on_coding_submission_change
AFTER INSERT OR UPDATE OR DELETE ON public.coding_submissions
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_user_xp();

-- 5. Set up triggers for assessment_submissions
DROP TRIGGER IF EXISTS on_assessment_submission_change ON public.assessment_submissions;
CREATE TRIGGER on_assessment_submission_change
AFTER INSERT OR UPDATE OR DELETE ON public.assessment_submissions
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_user_xp();

-- 6. Initial Backfill: Update XP for all existing students
UPDATE public.users u
SET xp = public.calculate_student_xp(u.id)
WHERE u.role = 'student';
