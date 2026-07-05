-- 0. Helper function for bucket name constant
CREATE OR REPLACE FUNCTION public.get_support_attachments_bucket() RETURNS text AS $$
BEGIN
  RETURN 'support-attachments';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES (public.get_support_attachments_bucket(), public.get_support_attachments_bucket(), true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up RLS policies for support-attachments bucket
-- Allow students to upload their own attachments
CREATE POLICY "Students can upload support attachments" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = public.get_support_attachments_bucket()
);

-- Allow authenticated users to view support attachments (RLS on table will handle access control to links)
CREATE POLICY "Anyone authenticated can view support attachments" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = public.get_support_attachments_bucket());

-- 3. Update support_messages table
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;
