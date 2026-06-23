/**
 * run-migration.mjs
 * 
 * One-time migration runner for the iframe + keyword validation feature.
 * 
 * USAGE:
 *   node scripts/run-migration.mjs
 * 
 * This script requires your SUPABASE_SERVICE_ROLE_KEY in .env
 * Get it from: Supabase Dashboard → Project Settings → API → service_role key
 * 
 * Add to .env:
 *   VITE_SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1Ni...
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env manually (simple parser)
const envPath = path.join(__dirname, '..', '.env')
const env = {}
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim()
})

const url = env['VITE_SUPABASE_URL']
const serviceKey = env['VITE_SUPABASE_SERVICE_KEY']

if (!url || !serviceKey) {
    console.error('\n❌ Missing credentials.')
    console.error('   Add VITE_SUPABASE_SERVICE_KEY to your .env file.')
    console.error('   Get it from: Supabase Dashboard → Project Settings → API → service_role secret\n')
    process.exit(1)
}

const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false }
})

const SQL = `
ALTER TABLE public.coding_challenges
ADD COLUMN IF NOT EXISTS reference_iframe_url TEXT;

ALTER TABLE public.coding_challenges  
ADD COLUMN IF NOT EXISTS required_keywords JSONB DEFAULT NULL;

COMMENT ON COLUMN public.coding_challenges.reference_iframe_url IS 
    'HTTPS URL to embed as a reference iframe in the student challenge view (HTML challenges only)';

COMMENT ON COLUMN public.coding_challenges.required_keywords IS 
    'JSON object: { "html": ["table","ul"], "css": ["display:flex"], "js": ["addEventListener"] }';
`

async function runMigration() {
    console.log('\n🚀 Running migration: add reference_iframe_url + required_keywords...\n')
    
    const { error } = await supabase.rpc('exec_sql', { query: SQL }).catch(() => ({ error: null }))
    
    // Try raw SQL via postgres endpoint if RPC doesn't exist
    const res = await fetch(`${url}/pg/query`, {
        method: 'POST',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: SQL })
    })
    
    if (res.ok) {
        console.log('✅ Migration applied successfully!\n')
        console.log('   New columns added to coding_challenges:')
        console.log('   • reference_iframe_url TEXT')
        console.log('   • required_keywords     JSONB\n')
    } else {
        const body = await res.text()
        console.error('❌ Migration failed via REST API.')
        console.error('\n📋 Please run the following SQL manually in your Supabase SQL Editor:')
        console.error('   https://supabase.com/dashboard/project/_/sql\n')
        console.error('─'.repeat(60))
        console.error(SQL)
        console.error('─'.repeat(60))
    }
}

runMigration()
