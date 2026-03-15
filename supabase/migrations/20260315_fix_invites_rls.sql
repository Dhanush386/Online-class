-- Fix organizer_invites RLS to allow unauthenticated checks
-- This is required because registration happens before the user is logged in.

-- 1. Drop the restrictive policy
DROP POLICY IF EXISTS "Anyone can check their own invite" ON public.organizer_invites;

-- 2. Create a new policy that allows 'anon' and 'authenticated' roles
-- We use 'public' as the target (default) or explicitly 'anon, authenticated'
CREATE POLICY "Anyone can check their own invite"
ON public.organizer_invites FOR SELECT
USING (true);

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
