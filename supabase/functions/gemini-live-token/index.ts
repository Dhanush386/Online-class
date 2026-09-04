// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

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
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    )

    const jwtToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized user session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('VITE_GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY secret is not configured in Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ephemeral token valid for 30 minutes, single session usage
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const googleRes = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
      method: 'POST',
      headers: {
        'x-goog-api-key': geminiApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uses: 1,
        expireTime
      })
    })

    if (!googleRes.ok) {
      const errText = await googleRes.text()
      console.error('Google AuthToken Error:', googleRes.status, errText)
      return new Response(
        JSON.stringify({ error: 'Failed to mint ephemeral token from Google', details: errText }),
        { status: googleRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokenData = await googleRes.json()
    return new Response(
      JSON.stringify({ token: tokenData.name, expireTime }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Gemini Live Token Error:', err)
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
