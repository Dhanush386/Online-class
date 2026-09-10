// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import jwt from "npm:jsonwebtoken@9.0.2"

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
            return new Response(JSON.stringify({ error: 'Unauthorized user session' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        // Fetch verified user profile from database to determine role (prevent client-side isModerator spoofing)
        const { data: profile } = await supabase
            .from('users')
            .select('id, name, email, role')
            .eq('id', user.id)
            .single()

        const isModeratorRole = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)
        const displayName = profile?.name || user.user_metadata?.name || 'Student'
        const displayEmail = profile?.email || user.email || ''

        const appId = Deno.env.get('JAAS_APP_ID')
        const kid = Deno.env.get('JAAS_KID')
        const privateKey = Deno.env.get('JAAS_PRIVATE_KEY')

        if (!appId || !kid || !privateKey) {
            throw new Error("Missing JaaS credentials in environment.")
        }

        const now = Math.floor(Date.now() / 1000)
        
        const payload: any = {
            aud: 'jitsi',
            iss: 'chat',
            sub: appId,
            room: '*',
            exp: now + 14400, // 4 hours
            nbf: now - 10,
            context: {
                user: {
                    name: displayName,
                    email: displayEmail,
                    avatar: '',
                },
                features: {
                    livestreaming: isModeratorRole,
                    recording: isModeratorRole,
                    transcription: true,
                    "outbound-call": false
                }
            }
        }

        // Only grant moderator permissions if the database role is instructor/admin
        if (isModeratorRole) {
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
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error?.message || 'Failed to mint token' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
