-- Add role column to organizer_invites
ALTER TABLE public.organizer_invites ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'organizer';

-- Update RLS policies for organizer_invites to include all admin roles
DROP POLICY IF EXISTS "Organizers can manage invites" ON public.organizer_invites;
CREATE POLICY "Organizers can manage invites"
ON public.organizer_invites FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('organizer', 'sub_admin', 'main_admin')
    )
);

-- Ensure select policy exists for registration flow
DROP POLICY IF EXISTS "Anyone can check their own invite" ON public.organizer_invites;
CREATE POLICY "Anyone can check their own invite"
ON public.organizer_invites FOR SELECT
TO authenticated
USING (true);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
