import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function deepDebug() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        
        console.log("--- TABLE SCHEMAS ---");
        const schemas = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'student_profiles';
        `);
        console.table(schemas.rows);

        console.log("--- USER EXISTENCE CHECK ---");
        const userId = '4fd1c90a-b674-4c4b-8d21-a0a711c9b2d3';
        const userCheck = await client.query(`
            SELECT id, email, role FROM users WHERE id = $1;
        `, [userId]);
        console.log("User in public.users:", userCheck.rows.length > 0 ? "YES" : "NO");
        if (userCheck.rows.length > 0) console.table(userCheck.rows);

        const authCheck = await client.query(`
            SELECT id, email FROM auth.users WHERE id = $1;
        `, [userId]);
        console.log("User in auth.users:", authCheck.rows.length > 0 ? "YES" : "NO");

        console.log("--- POSTGREST CONFIG ---");
        const pgConfig = await client.query(`
            SHOW search_path;
        `);
        console.log("Search Path:", pgConfig.rows[0].search_path);

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        await client.end();
    }
}

deepDebug();
