-- Enable Realtime for the users table
-- This allows the frontend to listen for changes to current_session_id
-- and automatically log out other devices.

BEGIN;
  -- Add the users table to the supabase_realtime publication
  -- If it's already there, this won't hurt, but we use a check just in case.
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'users'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
    END IF;
  END $$;
COMMIT;
