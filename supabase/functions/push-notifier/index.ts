// @ts-nocheck
// Supabase Edge Function: push-notifier
// Deploy using: supabase functions deploy push-notifier

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import webpush from "npm:web-push@3.6.6"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const jwtToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await authSupabase.auth.getUser(jwtToken)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user session' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Role check: Only staff (organizers/admins) can send broadcast notifications
    const { data: profile } = await authSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isStaff = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)
    if (!isStaff) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient privileges' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const privateVapidKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const publicVapidKey = Deno.env.get('VAPID_PUBLIC_KEY')

    if (!privateVapidKey || !publicVapidKey) {
      return new Response(JSON.stringify({ error: 'VAPID credentials not configured on server' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    webpush.setVapidDetails(
      'mailto:admin@learnova.com',
      publicVapidKey,
      privateVapidKey
    )

    const { title, message } = await req.json()
    const sanitizedTitle = String(title || 'Learnova Notification').slice(0, 100)
    const sanitizedMessage = String(message || '').slice(0, 500)

    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: subs, error } = await adminSupabase
      .from('push_subscriptions')
      .select('subscription_json, user_id')

    if (error || !subs) {
      return new Response(JSON.stringify({ error: error?.message || 'Failed to fetch subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const results = await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          sub.subscription_json,
          JSON.stringify({ title: sanitizedTitle, body: sanitizedMessage, url: '/' })
        )
        return { status: 'success' }
      } catch (e) {
        return { status: 'failed', error: e.message }
      }
    }))

    return new Response(JSON.stringify({ success: true, count: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
