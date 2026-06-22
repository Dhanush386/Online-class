import pg from 'pg';
const { Client } = pg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("Error: DATABASE_URL environment variable is not set. Please set it in your .env file or environment.");
    process.exit(1);
}

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
