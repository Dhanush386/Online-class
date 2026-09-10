// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory token bucket rate limiter per user ID (15 req / 10 min window)
const userRateLimits = new Map<string, { count: number; windowStart: number }>()
const USER_MAX_REQUESTS = 15
const USER_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

// Global circuit breaker: max 120 AI requests per minute across platform to safeguard API quotas
let globalWindowStart = Date.now()
let globalCount = 0
const GLOBAL_MAX_PER_MINUTE = 120

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number; reason?: string } {
  const now = Date.now()

  // Global circuit breaker
  if (now - globalWindowStart > 60000) {
    globalWindowStart = now
    globalCount = 0
  }
  globalCount++
  if (globalCount > GLOBAL_MAX_PER_MINUTE) {
    return { allowed: false, reason: 'System AI generation capacity temporarily saturated. Please try again shortly.' }
  }

  // Per-user limiter
  let record = userRateLimits.get(userId)
  if (!record || now - record.windowStart > USER_WINDOW_MS) {
    record = { count: 1, windowStart: now }
    userRateLimits.set(userId, record)
    return { allowed: true }
  }

  if (record.count >= USER_MAX_REQUESTS) {
    const retrySeconds = Math.ceil((record.windowStart + USER_WINDOW_MS - now) / 1000)
    return { 
      allowed: false, 
      retryAfter: retrySeconds,
      reason: `Rate limit exceeded. You may make at most ${USER_MAX_REQUESTS} AI requests per 10 minutes. Try again in ${retrySeconds}s.` 
    }
  }

  record.count++
  return { allowed: true }
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    )

    const jwtToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized session' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Rate limit check
    const rateCheck = checkRateLimit(user.id)
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({ error: rateCheck.reason }), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          ...(rateCheck.retryAfter ? { 'Retry-After': String(rateCheck.retryAfter) } : {})
        },
        status: 429,
      })
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY secret is not configured on server' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const body = await req.json()
    const { action, prompt, systemInstruction, temperature = 0.7, responseMimeType } = body

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(JSON.stringify({ error: 'Prompt is required and must be text' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Input sanitization and bounds checking
    const sanitizedPrompt = prompt.trim().slice(0, 3000)

    // Role-based privilege gating for admin generation actions
    if (['generate_questions', 'generate_challenges'].includes(action)) {
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      const isStaff = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)
      if (!isStaff) {
        return new Response(JSON.stringify({ error: 'Forbidden: Only instructors and administrators may generate curriculum content' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        })
      }
    }

    // Call Gemini API server-side
    const requestPayload: any = {
      contents: [{ parts: [{ text: sanitizedPrompt }] }],
      generationConfig: {
        temperature: Math.max(0, Math.min(1, Number(temperature) || 0.7)),
        ...(responseMimeType ? { responseMimeType } : {})
      }
    }

    if (systemInstruction) {
      requestPayload.systemInstruction = {
        parts: [{ text: String(systemInstruction).slice(0, 1000) }]
      }
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini proxy error:', geminiRes.status, errText)
      return new Response(JSON.stringify({ error: 'AI generation service error. Please try again.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: geminiRes.status >= 500 ? 502 : geminiRes.status,
      })
    }

    const data = await geminiRes.json()
    const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return new Response(JSON.stringify({ text: textOutput }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('ai-proxy error:', err)
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
