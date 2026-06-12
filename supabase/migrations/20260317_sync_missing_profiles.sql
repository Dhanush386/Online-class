-- 1. Create a function to manual sync missing profiles from auth.users to public.users
CREATE OR REPLACE FUNCTION public.sync_profiles_from_auth()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to read auth.users
AS $$
DECLARE
    inserted_count integer := 0;
    user_record record;
BEGIN
    FOR user_record IN 
        SELECT id, email, raw_user_meta_data->>'name' as name, raw_user_meta_data->>'role' as role
        FROM auth.users
        WHERE id NOT IN (SELECT id FROM public.users)
    LOOP
        INSERT INTO public.users (id, email, name, role, status)
        VALUES (
            user_record.id, 
            user_record.email, 
            COALESCE(user_record.name, 'New User'), 
            COALESCE(user_record.role, 'student'),
            CASE WHEN user_record.role = 'student' THEN 'pending' ELSE 'approved' END
        )
        ON CONFLICT (id) DO NOTHING;
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN json_build_object('status', 'success', 'synced_count', inserted_count);
END;
$$;

-- 2. Improve the handle_new_user trigger to be more robust (Self-healing)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, status)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'student'),
    CASE 
      WHEN (new.raw_user_meta_data->>'role') = 'student' THEN 'pending'
      ELSE 'approved' 
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  RETURN new;
END;
$$;

-- Re-apply trigger just in case (though it should already exist)
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
