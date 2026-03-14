-- Harmonize Users table RLS and constraints
-- 1. Ensure role constraint is correct
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('organizer', 'student', 'main_admin', 'sub_admin'));

-- 2. Drop all old policies to start fresh
DROP POLICY IF EXISTS "Users can read all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Allow profile updates" ON public.users;
DROP POLICY IF EXISTS "Allow profile deletion" ON public.users;
DROP POLICY IF EXISTS "Organizers can update student profiles" ON public.users;
DROP POLICY IF EXISTS "Organizers can delete users" ON public.users;

-- 3. Create clean, hierarchical policies
-- SELECT: Everyone can read basic profile info (required for names/avatars in UI)
CREATE POLICY "Enable read access for all users"
ON public.users FOR SELECT
TO authenticated
USING (true);

-- INSERT: Allow any authenticated user to create their own initial profile
-- The 'with check' ensures they can only create a profile with their own UID
CREATE POLICY "Enable insert for own profile"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- UPDATE: Users can update their own profile
-- Main Admins and Organizers can update other profiles (management)
CREATE POLICY "Enable update for own profile or admins"
ON public.users FOR UPDATE
TO authenticated
USING (
    (auth.uid() = id) OR
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('main_admin', 'organizer')
    )
)
WITH CHECK (
    (auth.uid() = id) OR
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('main_admin', 'organizer')
    )
);

-- DELETE: Main Admins and Organizers can delete users
CREATE POLICY "Enable delete for admins"
ON public.users FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('main_admin', 'organizer')
    )
);

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
