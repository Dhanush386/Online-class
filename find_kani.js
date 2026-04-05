import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function findUser() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query("SELECT id, name, email, role FROM public.users WHERE name ILIKE '%Kani%'");
        console.log("Matching Users Found:");
        console.table(res.rows);
    } catch (err) {
        console.error("Error finding user:", err);
    } finally {
        await client.end();
    }
}

findUser();
