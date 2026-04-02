import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function reloadSchema() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        await client.query(`NOTIFY pgrst, 'reload schema';`);
        console.log("Schema reloaded successfully!");
    } catch (err) {
        console.error("Error reloading schema:", err.message);
    } finally {
        await client.end();
    }
}

reloadSchema();
