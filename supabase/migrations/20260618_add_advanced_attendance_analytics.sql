ALTER TABLE public.live_attendance DROP CONSTRAINT IF EXISTS live_attendance_attendance_status_check;

ALTER TABLE public.live_attendance ADD CONSTRAINT live_attendance_attendance_status_check 
CHECK (attendance_status IN ('insufficient_time', 'present', 'absent', 'late', 'left_early'));

ALTER TABLE public.live_attendance
ADD COLUMN IF NOT EXISTS first_joined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_left_at TIMESTAMPTZ;
