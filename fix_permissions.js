import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function fixPermissions() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        // Ensure table is in public schema
        const schemaCheck = await client.query("SELECT table_schema FROM information_schema.tables WHERE table_name = 'student_profiles'");
        console.log("Current schema(s):", schemaCheck.rows.map(r => r.table_schema).join(', '));

        await client.query('GRANT ALL ON TABLE student_profiles TO postgres, service_role, authenticated, anon;');
        await client.query("NOTIFY pgrst, 'reload schema';");
        
        console.log("Permissions granted and schema reload triggered!");
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await client.end();
    }
}

fixPermissions();
