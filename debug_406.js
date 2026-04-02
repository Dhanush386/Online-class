import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function debug406() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        // Check columns and types
        console.log("--- TABLE STRUCTURE ---");
        const cols = await client.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'student_profiles'
            ORDER BY ordinal_position;
        `);
        console.table(cols.rows);

        // Check for duplicates or weird names
        const duplicate_cols = await client.query(`
            SELECT column_name, COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'student_profiles' 
            GROUP BY column_name 
            HAVING COUNT(*) > 1;
        `);
        if (duplicate_cols.rows.length > 0) {
            console.log("!!! DUPLICATE COLUMNS FOUND !!!");
            console.table(duplicate_cols.rows);
        }

        // Check RLS
        console.log("--- RLS STATUS ---");
        const rls = await client.query(`
            SELECT relname, relrowsecurity 
            FROM pg_class 
            WHERE oid = 'student_profiles'::regclass;
        `);
        console.table(rls.rows);

        // Check if anyone can even talk to this table via PostgREST
        const privileges = await client.query(`
            SELECT grantee, privilege_type 
            FROM information_schema.role_table_grants 
            WHERE table_name = 'student_profiles';
        `);
        console.log("--- PRIVILEGES ---");
        console.table(privileges.rows);

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await client.end();
    }
}

debug406();
