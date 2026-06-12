-- Fix RLS for admin_course_assignments
-- Enable Row Level Security
ALTER TABLE public.admin_course_assignments ENABLE ROW LEVEL SECURITY;

-- 1. Main admins have full access to manage assignments
DROP POLICY IF EXISTS "Main admins have full access to manage assignments" ON public.admin_course_assignments;
CREATE POLICY "Main admins have full access to manage assignments"
ON public.admin_course_assignments FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'main_admin')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'main_admin')
);

-- 2. Sub admins can view their own course assignments
DROP POLICY IF EXISTS "Admins can view their own assignments" ON public.admin_course_assignments;
CREATE POLICY "Admins can view their own assignments"
ON public.admin_course_assignments FOR SELECT
TO authenticated
USING (
    admin_id = auth.uid()
);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
