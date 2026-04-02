import pg from 'pg';
const { Client } = pg;

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

async function testCrypto() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query(`SELECT crypt('test', gen_salt('bf')) AS hashed;`);
        console.log("Crypto available:", res.rows[0].hashed);
    } catch (err) {
        console.error("Crypto error:", err.message);
    } finally {
        await client.end();
    }
}

testCrypto();
