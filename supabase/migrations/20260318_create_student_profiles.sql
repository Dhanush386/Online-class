-- Create student_profiles table
CREATE TABLE IF NOT EXISTS student_profiles (
    student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    certificate_name TEXT,
    gender TEXT,
    languages_communication JSONB DEFAULT '[]',
    language_teaching TEXT,
    language_watching TEXT,
    dob DATE,
    linkedin_url TEXT,
    twitter_url TEXT,
    github_url TEXT,
    codechef_url TEXT,
    hackerrank_url TEXT,
    leetcode_url TEXT,
    resume_url TEXT,
    photo_url TEXT,
    whatsapp_number TEXT,
    parent_first_name TEXT,
    parent_last_name TEXT,
    parent_relation TEXT,
    parent_occupation TEXT,
    parent_email TEXT,
    parent_phone TEXT,
    parent_whatsapp TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    country TEXT DEFAULT 'India',
    pincode TEXT,
    state TEXT,
    district TEXT,
    city TEXT,
    coding_level TEXT,
    has_laptop BOOLEAN DEFAULT FALSE,
    technical_skills JSONB DEFAULT '[]',
    education_details JSONB DEFAULT '[]',
    work_experience JSONB DEFAULT '[]',
    projects_achievements JSONB DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile" 
ON student_profiles FOR SELECT 
USING (auth.uid() = student_id);

CREATE POLICY "Users can update their own profile" 
ON student_profiles FOR UPDATE 
USING (auth.uid() = student_id);

CREATE POLICY "Users can insert their own profile" 
ON student_profiles FOR INSERT 
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Organizers can view all student profiles" 
ON student_profiles FOR SELECT 
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('organizer', 'sub_admin', 'main_admin')));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_student_profiles_updated_at
    BEFORE UPDATE ON student_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
