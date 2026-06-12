-- 1. Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up RLS policies for support-attachments bucket
-- Allow students to upload their own attachments
CREATE POLICY "Students can upload support attachments" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'support-attachments'
);

-- Allow authenticated users to view support attachments (RLS on table will handle access control to links)
CREATE POLICY "Anyone authenticated can view support attachments" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'support-attachments');

-- 3. Update support_messages table
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;
