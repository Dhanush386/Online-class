import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function testRpc() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // 1. Create a dummy test function
        await client.query(`
            CREATE OR REPLACE FUNCTION test_update_password(p_email TEXT, p_new_password TEXT)
            RETURNS BOOLEAN
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            DECLARE
                v_user_id UUID;
            BEGIN
                -- Find user
                SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
                IF v_user_id IS NULL THEN
                    RETURN FALSE;
                END IF;

                -- Update password
                UPDATE auth.users
                SET encrypted_password = crypt(p_new_password, gen_salt('bf'))
                WHERE id = v_user_id;

                RETURN TRUE;
            END;
            $$;
        `);
        console.log("Function created successfully.");

        // We won't actually call it here to avoid messing up a real user's password,
        // but creating it confirms that SECURITY DEFINER can be established.
        // Let's actually create a dummy user to test it.
        // Actually, we can just drop it.
        await client.query(`DROP FUNCTION test_update_password;`);
        console.log("Function dropped successfully.");

    } catch (err) {
        console.error("RPC error:", err.message);
    } finally {
        await client.end();
    }
}

testRpc();
