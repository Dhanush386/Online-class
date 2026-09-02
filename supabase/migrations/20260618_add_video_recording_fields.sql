-- Migration: Add detailed recording metadata to public.videos
ALTER TABLE public.videos
ADD COLUMN IF NOT EXISTS drive_file_id text,
ADD COLUMN IF NOT EXISTS recording_status text,
ADD COLUMN IF NOT EXISTS duration_seconds integer,
ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS recorded_at timestamptz,
ADD COLUMN IF NOT EXISTS file_size_mb numeric(10,2);
