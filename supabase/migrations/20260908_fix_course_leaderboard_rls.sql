-- Migration: Fix Course Leaderboard Visibility & Classmate Scope
-- 1. Update RLS on enrollments so students can see classmates in their enrolled courses
-- 2. Add secure RPC function get_course_leaderboard to fetch enrolled classmates for leaderboard ranking

-- Allow students to view peer enrollments for courses they themselves are enrolled in
DROP POLICY IF EXISTS "enrollments_select" ON public.enrollments;
CREATE POLICY "enrollments_select" ON public.enrollments
  FOR SELECT USING (
    student_id = auth.uid() 
    OR public.is_staff()
    OR public.is_enrolled(course_id)
  );

-- Function to fetch course leaderboard directly with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.get_course_leaderboard(p_course_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    avatar_url text,
    xp integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Security verification: Caller must be staff or enrolled in this course
    IF NOT (public.is_staff() OR public.is_enrolled(p_course_id)) THEN
        RAISE EXCEPTION 'Not authorized to view leaderboard for this course';
    END IF;

    RETURN QUERY
    SELECT 
        u.id,
        u.name,
        u.avatar_url,
        COALESCE(u.xp, 0)::integer AS xp
    FROM public.enrollments e
    JOIN public.users u ON u.id = e.student_id
    WHERE e.course_id = p_course_id
      AND u.role = 'student'
    ORDER BY COALESCE(u.xp, 0) DESC, u.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_course_leaderboard(uuid) TO authenticated;
