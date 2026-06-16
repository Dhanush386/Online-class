import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import jwt from "npm:jsonwebtoken@9.0.2"

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
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            throw new Error('Unauthorized')
        }

        // Get user profile
        const { data: profile } = await supabase
            .from('users')
            .select('name, role, email')
            .eq('id', user.id)
            .single()

        const { roomName } = await req.json()
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
            iss: apiKey,
            sub: user.id,
            name: userName,
            nbf: now,
            exp: now + 21600, // 6 hours
            video: {
                roomJoin: true,
                room: roomName,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
            },
            metadata: JSON.stringify({
                userId: user.id,
                name: userName,
                role: profile?.role || 'student',
                email: profile?.email || user.email || ''
            })
        }

        // Organizers get admin permissions
        if (isOrganizer) {
            payload.video.roomAdmin = true
            payload.video.roomCreate = true
        }

        const token = jwt.sign(payload, apiSecret, {
            algorithm: 'HS256',
            header: {
                typ: 'JWT',
                alg: 'HS256'
            }
        })

        return new Response(JSON.stringify({ token }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        console.error('Token generation error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
