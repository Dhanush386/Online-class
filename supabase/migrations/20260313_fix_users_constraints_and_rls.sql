-- Fix Users table constraints and RLS for Admin roles

-- 1. Correct the role check constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('organizer', 'student', 'main_admin', 'sub_admin'));

-- 2. Update RLS policies for public.users
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Organizers can update student profiles" ON public.users;
DROP POLICY IF EXISTS "Organizers can delete users" ON public.users;

-- Re-create policies with support for all roles and hierarchical access

-- INSERT: Allow any authenticated user to create their own profile
CREATE POLICY "Users can insert own profile" 
ON public.users FOR INSERT 
WITH CHECK (auth.uid() = id);

-- UPDATE: Allow users to update their own profile (session management, name changed, etc)
-- OR allow Main Admins/Organizers to update profiles
CREATE POLICY "Allow profile updates" 
ON public.users FOR UPDATE
USING (
    (auth.uid() = id) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('main_admin', 'organizer'))
)
WITH CHECK (
    (auth.uid() = id) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('main_admin', 'organizer'))
);

-- DELETE: Allow Main Admins and Organizers to delete users
CREATE POLICY "Allow profile deletion" 
ON public.users FOR DELETE
USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('main_admin', 'organizer'))
);

-- Ensure public read access remains (used for dashboard labels etc)
DROP POLICY IF EXISTS "Users can read all profiles" ON public.users;
CREATE POLICY "Users can read all profiles" 
ON public.users FOR SELECT 
USING (true);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
