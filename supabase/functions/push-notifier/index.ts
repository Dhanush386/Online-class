// Supabase Edge Function: push-notifier
// Deploy using: supabase functions deploy push-notifier

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import * as webpush from "https://esm.sh/web-push@3.6.0"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// VAPID Keys
const PRIVATE_VAPID_KEY = 'T4vhToYTygHAvBh0hA-nrbJWMItFyg2lcghmL2lLBOw';
const PUBLIC_VAPID_KEY = 'BMoLIbjN-o7XHbkgBYXBLdpno9Css3OtoY0oIJ44W296xrxhwKy_q6zbudE3v2ZQXTRGLT50cy5vlaGuG9zR2MY';

webpush.setVapidDetails(
  'mailto:admin@learnova.com',
  PUBLIC_VAPID_KEY,
  PRIVATE_VAPID_KEY
);

serve(async (req) => {
  const { title, message, target } = await req.json();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch matching subscriptions
  let query = supabase.from('push_subscriptions').select('subscription_json, user_id');
  
  // If target is specific, we might need a join with 'users' table 
  // to filter by role. Let's keep it simple for now.
  const { data: subs, error } = await query;

  if (error || !subs) {
    return new Response(JSON.stringify({ error: error?.message }), { status: 500 });
  }

  // 2. Send push to each subscriber
  const results = await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        sub.subscription_json,
        JSON.stringify({ title, body: message, url: '/' })
      );
      return { status: 'success' };
    } catch (e) {
      return { status: 'failed', error: e.message };
    }
  }));

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
})
