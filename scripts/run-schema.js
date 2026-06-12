import pg from 'pg';
const { Client } = pg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = "postgresql://postgres.pdkkznkwybvilkpmxqmx:Dhanush@2404@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";
const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');

async function run() {
    const client = new Client({ connectionString });
    try {
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await client.connect();
        console.log('Connected to database');
        await client.query(sql);
        console.log('Schema executed successfully!');
    } catch (err) {
        console.error('Error executing schema:', err);
    } finally {
        await client.end();
    }
}

run();
