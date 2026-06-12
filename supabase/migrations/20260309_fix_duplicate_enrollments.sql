-- 1. Identify and delete duplicate enrollments
-- This keeps the row with the smallest (earliest) id for each student_id/course_id pair
DELETE FROM public.enrollments a
USING public.enrollments b
WHERE a.id > b.id
  AND a.student_id = b.student_id
  AND a.course_id = b.course_id;

-- 2. Add a unique constraint if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'enrollments_student_id_course_id_key'
    ) THEN
        ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_student_id_course_id_key UNIQUE (student_id, course_id);
    END IF;
END $$;
