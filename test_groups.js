import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env', 'utf8')
const env = {}
envFile.split('\n').forEach(line => {
    const [key, ...values] = line.split('=')
    if (key && values.length > 0) {
        env[key.trim()] = values.join('=').trim()
    }
})

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

async function test() {
    console.log("Fetching groups...")
    const { data: groups, error: gErr } = await supabase.from('groups').select('id, name, course_id, organizer_id')
    console.log("Groups:", groups, gErr)
}

test()
