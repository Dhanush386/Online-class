import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function test() {
    console.log("Fetching groups...")
    const { data: groups, error: gErr } = await supabase.from('groups').select('id, name, course_id, organizer_id')
    console.log("Groups:", groups, gErr)

    console.log("Fetching challenges...")
    const { data: challenges, error: cErr } = await supabase.from('coding_challenges').select('id, title, course_id')
    console.log("Challenges:", challenges, cErr)
}

test()
