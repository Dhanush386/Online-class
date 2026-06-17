ALTER TABLE public.live_attendance
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS xp_awarded BOOLEAN DEFAULT false;

-- We also want to allow the service role (from Edge Functions) to update this table without restrictions, which it can by default.

-- Enable Realtime for the live_attendance table so the frontend can listen to xp_awarded updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_attendance;
