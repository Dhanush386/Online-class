import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const supabaseUrl = Deno.env.get('SUPABASE_URL') || process.env.SUPABASE_URL;
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    console.log("Testing getUser with ANON KEY...");
    const { data, error } = await supabase.auth.getUser(supabaseKey);
    console.log("Error:", error?.message);
}
run();
