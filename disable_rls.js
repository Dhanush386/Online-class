import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function disableRLS() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        await client.query('ALTER TABLE student_profiles DISABLE ROW LEVEL SECURITY;');
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log("RLS disabled and schema reload triggered!");
    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await client.end();
    }
}

disableRLS();
