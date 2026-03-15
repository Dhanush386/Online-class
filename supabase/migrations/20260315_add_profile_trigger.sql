-- Database trigger to automatically create a profile in public.users when a new user signs up in auth.users.
-- This bypasses RLS issues during the registration flow where the user might not be fully authenticated yet.

-- 1. Create the trigger function
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
      WHEN COALESCE(new.raw_user_meta_data->>'role', 'student') = 'student' THEN 'pending'
      ELSE 'approved'
    END
  );
  RETURN new;
END;
$$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Grant necessary permissions (though SECURITY DEFINER handles most of this)
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.users TO postgres, service_role;
