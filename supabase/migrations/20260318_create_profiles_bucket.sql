-- Create storage bucket for profiles
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for profiles bucket
CREATE POLICY "Public profiles are viewable by everyone" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'profiles');

CREATE POLICY "Users can upload their own profile files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own profile files" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own profile files" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'profiles' AND auth.uid()::text = (storage.foldername(name))[1]);
