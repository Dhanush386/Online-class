import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function recreateTable() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        console.log("Dropping table...");
        await client.query('DROP TABLE IF EXISTS student_profiles CASCADE;');

        console.log("Creating table...");
        await client.query(`
            CREATE TABLE student_profiles (
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
                phone TEXT,
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
        `);

        console.log("Enabling RLS and setting policies...");
        await client.query('ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;');
        await client.query(`
            CREATE POLICY "Users can view their own profile" ON student_profiles FOR SELECT USING (auth.uid() = student_id);
            CREATE POLICY "Users can update their own profile" ON student_profiles FOR UPDATE USING (auth.uid() = student_id);
            CREATE POLICY "Users can insert their own profile" ON student_profiles FOR INSERT WITH CHECK (auth.uid() = student_id);
            CREATE POLICY "Organizers can view all student profiles" ON student_profiles FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('organizer', 'sub_admin', 'main_admin')));
        `);

        console.log("Granting privileges...");
        await client.query('GRANT ALL ON TABLE student_profiles TO postgres, service_role, authenticated, anon;');

        console.log("Adding trigger...");
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
        await client.query('DROP TRIGGER IF EXISTS update_student_profiles_updated_at ON student_profiles;');
        await client.query(`
            CREATE TRIGGER update_student_profiles_updated_at
                BEFORE UPDATE ON student_profiles
                FOR EACH ROW
                EXECUTE PROCEDURE update_updated_at_column();
        `);

        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log("Refining complete! Table re-created and schema reloaded.");

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await client.end();
    }
}

recreateTable();
