-- RPC to permanently delete a user from both public and auth schemas
-- Security definer to allow deleting from auth.users
CREATE OR REPLACE FUNCTION public.delete_user_permanently(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_role TEXT;
    v_target_role TEXT;
BEGIN
    -- 1. Get the role of the caller (auth.uid())
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    
    -- 2. Get the role of the target user
    SELECT role INTO v_target_role FROM public.users WHERE id = target_user_id;

    -- 3. Security checks
    -- Cannot delete yourself
    IF auth.uid() = target_user_id THEN
        RAISE EXCEPTION 'You cannot delete your own account permanently from here.';
    END IF;

    -- Main Admin can delete anyone (Organizers, Sub-Admins, Students)
    -- Organizer can only delete Students
    -- Sub-Admin cannot delete anyone
    IF v_caller_role = 'main_admin' THEN
        -- Allowed to delete any role
    ELSIF v_caller_role = 'organizer' AND v_target_role = 'student' THEN
        -- Allowed to delete students
    ELSE
        RAISE EXCEPTION 'Permission denied. You do not have the required role to delete this user.';
    END IF;

    -- 4. Delete from auth.users (cascades to public.users)
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN TRUE;
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_permanently(UUID) TO authenticated;
