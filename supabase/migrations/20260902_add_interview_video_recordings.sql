-- ============================================================
-- Migration: AI Mock Interview Video Recordings & 24h Auto-Purge
-- ============================================================

-- 1. Add recording columns to mock_interview_sessions
ALTER TABLE public.mock_interview_sessions
ADD COLUMN IF NOT EXISTS recording_url TEXT,
ADD COLUMN IF NOT EXISTS recording_expires_at TIMESTAMPTZ;

-- 2. Create Storage Bucket for Interview Recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('interview-recordings', 'interview-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for interview-recordings bucket
DROP POLICY IF EXISTS "Public Select Access for Interview Recordings" ON storage.objects;
CREATE POLICY "Public Select Access for Interview Recordings" ON storage.objects
    FOR SELECT USING (bucket_id = 'interview-recordings');

DROP POLICY IF EXISTS "Authenticated Insert Access for Student Interview Recordings" ON storage.objects;
CREATE POLICY "Authenticated Insert Access for Student Interview Recordings" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'interview-recordings');

DROP POLICY IF EXISTS "Authenticated Delete Access for Interview Recordings" ON storage.objects;
CREATE POLICY "Authenticated Delete Access for Interview Recordings" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'interview-recordings');

-- 4. Function to purge expired interview recordings (24h retention)
CREATE OR REPLACE FUNCTION public.purge_expired_interview_recordings()
RETURNS void AS $$
BEGIN
    -- Reset recording URL for sessions older than 24 hours
    UPDATE public.mock_interview_sessions
    SET recording_url = NULL
    WHERE recording_expires_at IS NOT NULL 
      AND recording_expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
