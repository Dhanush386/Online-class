import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function fixRpc() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // Let's first check where pgcrypto is installed
        const res = await client.query(`
            SELECT extnamespace::regnamespace AS schema_name
            FROM pg_extension
            WHERE extname = 'pgcrypto';
        `);
        console.log("pgcrypto is in schema:", res.rows[0]?.schema_name);

        const schema = res.rows[0]?.schema_name || 'extensions';

        // Update the function to include that schema in the search_path
        await client.query(`
            CREATE OR REPLACE FUNCTION public.reset_student_password(
                p_email TEXT,
                p_reset_code TEXT,
                p_new_password TEXT
            )
            RETURNS BOOLEAN
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public, auth, ${schema}
            AS $$
            DECLARE
                v_user_id UUID;
                v_organizer_id UUID;
                v_new_code TEXT;
            BEGIN
                -- 1. Verify the reset code exists and get the organizer
                SELECT organizer_id INTO v_organizer_id
                FROM public.organizer_reset_codes
                WHERE code = p_reset_code;

                IF v_organizer_id IS NULL THEN
                    -- Invalid code
                    RETURN FALSE;
                END IF;

                -- 2. Find the user by email
                SELECT id INTO v_user_id
                FROM auth.users
                WHERE email = p_email;

                IF v_user_id IS NULL THEN
                    -- User not found
                    RETURN FALSE;
                END IF;

                -- 3. Update the user's password using pgcrypto
                UPDATE auth.users
                SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
                    updated_at = now()
                WHERE id = v_user_id;

                -- 4. Generate a new code for the organizer to invalidate the old one
                v_new_code := public.generate_6_digit_code();
                
                UPDATE public.organizer_reset_codes
                SET code = v_new_code,
                    updated_at = now()
                WHERE organizer_id = v_organizer_id;

                RETURN TRUE;
            END;
            $$;
        `);
        console.log("RPC function updated recursively with new search_path.");

        await client.query(`NOTIFY pgrst, 'reload schema';`);
        console.log("Schema reloaded.");

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await client.end();
    }
}

fixRpc();
