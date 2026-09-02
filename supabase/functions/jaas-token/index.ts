import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
        const { userName, userEmail, isModerator, avatarUrl } = await req.json()

        const appId = Deno.env.get('JAAS_APP_ID')
        const kid = Deno.env.get('JAAS_KID')
        const privateKey = Deno.env.get('JAAS_PRIVATE_KEY')

        if (!appId || !kid || !privateKey) {
            throw new Error("Missing JaaS credentials in environment.")
        }

        const now = Math.floor(Date.now() / 1000)
        
        const payload = {
            aud: 'jitsi',
            iss: 'chat',
            sub: appId,
            room: '*',
            exp: now + 14400, // 4 hours
            nbf: now - 10,
            context: {
                user: {
                    name: userName || 'Student',
                    email: userEmail || '',
                    avatar: avatarUrl || '',
                },
                features: {
                    livestreaming: true,
                    recording: true,
                    transcription: true,
                    "outbound-call": true
                }
            }
        }

        if (isModerator) {
            payload.context.user.moderator = "true"
        }

        const token = jwt.sign(payload, privateKey.replaceAll(String.raw`\n`, '\n'), {
            algorithm: 'RS256',
            header: {
                kid: kid,
                typ: 'JWT',
                alg: 'RS256'
            }
        })

        return new Response(JSON.stringify({ token }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
