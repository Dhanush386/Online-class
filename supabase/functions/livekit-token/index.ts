import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { SignJWT, decodeJwt } from "https://deno.land/x/jose@v4.15.4/index.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Verify the user is authenticated via Supabase
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('Missing authorization header')
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
        if (!jwtToken) {
            throw new Error(`Unauthorized: Empty token | Header: ${authHeader}`)
        }
        
        console.log(`Auth Header: ${authHeader.substring(0, 15)}...`)
        console.log(`JWT Token: ${jwtToken.substring(0, 10)}...`)

        // Decode claims locally for debug logging
        try {
            const decoded = decodeJwt(jwtToken)
            console.log('Decoded claims:', JSON.stringify(decoded))
        } catch (jwtErr) {
            console.error('Failed to decode JWT locally:', jwtErr)
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken)
        if (authError || !user) {
            console.error('Auth Error Details:', authError)
            throw new Error(`Unauthorized: ${authError?.message || 'No user found'} | Header: present | TokenLength: ${jwtToken.length}`)
        }

        // Get user profile
        const { data: profile } = await supabase
            .from('users')
            .select('name, role, email')
            .eq('id', user.id)
            .single()

        const { roomName, proctoringMode } = await req.json()
        if (!roomName) throw new Error('roomName is required')

        const apiKey = Deno.env.get('LIVEKIT_API_KEY')
        const apiSecret = Deno.env.get('LIVEKIT_API_SECRET')

        if (!apiKey || !apiSecret) {
            throw new Error('Missing LiveKit credentials in environment')
        }

        const isOrganizer = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)
        const userName = profile?.name || (isOrganizer ? 'Instructor' : 'Student')

        const now = Math.floor(Date.now() / 1000)

        // Build LiveKit Access Token (JWT)
        const payload = {
            name: userName,
            video: {
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
                canUpdateOwnMetadata: true,
            },
            metadata: JSON.stringify({
                userId: user.id,
                name: userName,
                role: profile?.role || 'student',
                email: profile?.email || user.email || ''
            })
        }

        // Apply strict permissions for Proctoring Mode
        if (proctoringMode) {
            if (isOrganizer) {
                // Organizers can watch, but don't need to publish their own video to students
                payload.video.canPublish = false;
                payload.video.canSubscribe = true;
            } else {
                // Students can publish their video, but cannot watch other students
                payload.video.canPublish = true;
                payload.video.canSubscribe = false;
            }
        }

        // Organizers get admin permissions
        if (isOrganizer) {
            payload.video.roomAdmin = true
            payload.video.roomCreate = true
        }

        const secret = new TextEncoder().encode(apiSecret)

        const token = await new SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setIssuer(apiKey)
            .setSubject(user.id)
            .setNotBefore(now)
            .setExpirationTime(now + 21600) // 6 hours
            .sign(secret)

        return new Response(JSON.stringify({ token }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('Token generation error:', error)
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }
})
