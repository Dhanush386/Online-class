-- Role-Based Admin Management Migration

-- 1. Create assignments table
CREATE TABLE IF NOT EXISTS public.admin_course_assignments (
    admin_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (admin_id, course_id)
);

-- 2. Add created_by to questions/challenges tracking
ALTER TABLE public.coding_challenges ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

-- 3. Update RLS on courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Main admins have full access to courses" ON public.courses;
CREATE POLICY "Main admins have full access to courses"
ON public.courses FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'main_admin')
);

DROP POLICY IF EXISTS "Sub admins can view assigned courses" ON public.courses;
CREATE POLICY "Sub admins can view assigned courses"
ON public.courses FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_course_assignments 
        WHERE admin_id = auth.uid() AND course_id = public.courses.id
    ) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'main_admin'
    )
);

DROP POLICY IF EXISTS "Sub admins can update assigned courses" ON public.courses;
CREATE POLICY "Sub admins can update assigned courses"
ON public.courses FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.admin_course_assignments 
        WHERE admin_id = auth.uid() AND course_id = public.courses.id
    )
);

-- 4. Update RLS for Coding Challenges
DROP POLICY IF EXISTS "Management access for coding challenges" ON public.coding_challenges;
CREATE POLICY "Management access for coding challenges"
ON public.coding_challenges FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'main_admin') OR
    EXISTS (
        SELECT 1 FROM public.admin_course_assignments 
        WHERE admin_id = auth.uid() AND course_id = public.coding_challenges.course_id
    )
);

-- 5. Update RLS for Assessments
DROP POLICY IF EXISTS "Management access for assessments" ON public.assessments;
CREATE POLICY "Management access for assessments"
ON public.assessments FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'main_admin') OR
    EXISTS (
        SELECT 1 FROM public.admin_course_assignments 
        WHERE admin_id = auth.uid() AND course_id = public.assessments.course_id
    )
);

-- 6. Update RLS for Videos (Sessions)
DROP POLICY IF EXISTS "Management access for videos" ON public.videos;
CREATE POLICY "Management access for videos"
ON public.videos FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'main_admin') OR
    EXISTS (
        SELECT 1 FROM public.admin_course_assignments 
        WHERE admin_id = auth.uid() AND course_id = public.videos.course_id
    )
);

-- 7. Update RLS for Resources
DROP POLICY IF EXISTS "Management access for resources" ON public.course_resources;
CREATE POLICY "Management access for resources"
ON public.course_resources FOR ALL
TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'main_admin') OR
    EXISTS (
        SELECT 1 FROM public.admin_course_assignments 
        WHERE admin_id = auth.uid() AND course_id = public.course_resources.course_id
    )
);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
