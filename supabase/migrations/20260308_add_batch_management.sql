-- New tables for Batch Management and Access Control

-- 1. Groups table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    organizer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, course_id)
);

-- 2. Group members (Students in Groups)
CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, student_id)
);

-- 3. Resource access control (Lock/Unlock)
CREATE TABLE IF NOT EXISTS public.resource_access (
    resource_id UUID NOT NULL, -- ID of coding challenge or assessment
    resource_type TEXT NOT NULL CHECK (resource_type IN ('coding', 'assessment')),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    is_locked BOOLEAN DEFAULT true,
    PRIMARY KEY (resource_id, group_id)
);

-- RLS Policies
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_access ENABLE ROW LEVEL SECURITY;

-- Organizers can manage their own groups
CREATE POLICY "Organizers can manage their groups" ON public.groups
    FOR ALL USING (auth.uid() = organizer_id);

-- Everyone (enrolled) can see groups for their course
CREATE POLICY "Students can see groups for their course" ON public.groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.enrollments 
            WHERE enrollments.course_id = groups.course_id 
            AND enrollments.student_id = auth.uid()
        )
    );

-- Organizers can manage memberships for their groups
CREATE POLICY "Organizers can manage group memberships" ON public.group_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.groups
            WHERE groups.id = group_members.group_id
            AND groups.organizer_id = auth.uid()
        )
    );

-- Students can see their own memberships
CREATE POLICY "Students can see their memberships" ON public.group_members
    FOR SELECT USING (student_id = auth.uid());

-- Organizers can manage resource access for their groups
CREATE POLICY "Organizers can manage resource access" ON public.resource_access
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.groups
            WHERE groups.id = resource_access.group_id
            AND groups.organizer_id = auth.uid()
        )
    );

-- Students can see access for their groups
CREATE POLICY "Students can see resource access" ON public.resource_access
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_members.group_id = resource_access.group_id
            AND group_members.student_id = auth.uid()
        )
    );
