import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function runMigration() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        console.log("Creating face_verifications table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.face_verifications (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
                period TEXT NOT NULL CHECK (period IN ('morning', 'afternoon', 'evening', 'night')),
                date DATE DEFAULT CURRENT_DATE,
                verified_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(user_id, period, date)
            );

            -- Ensure RLS is enabled
            ALTER TABLE public.face_verifications ENABLE ROW LEVEL SECURITY;

            -- Create policy for students to insert their own verifications
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students can insert their own face verifications') THEN
                    CREATE POLICY "Students can insert their own face verifications" 
                    ON public.face_verifications 
                    FOR INSERT 
                    WITH CHECK (auth.uid() = user_id);
                END IF;
            END $$;

            -- Create policy for students to view their own face verifications
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Students can view their own face verifications') THEN
                    CREATE POLICY "Students can view their own face verifications" 
                    ON public.face_verifications 
                    FOR SELECT 
                    USING (auth.uid() = user_id);
                END IF;
            END $$;
        `);
        
        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

runMigration();
