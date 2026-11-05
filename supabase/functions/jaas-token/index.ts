import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import jwt from "npm:jsonwebtoken@9.0.2"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(body: Record<string, unknown>, status: number) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }
    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405)
    }

    try {
        const authHeader = req.headers.get("Authorization")
        const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
        if (!bearerToken) {
            return jsonResponse({ error: "Authentication required" }, 401)
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error("Supabase environment is not configured")
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader! } },
            auth: { persistSession: false, autoRefreshToken: false },
        })

        const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken)
        if (authError || !user) {
            return jsonResponse({ error: "Invalid or expired session" }, 401)
        }

        const { data: profile, error: profileError } = await supabase
            .from("users")
            .select("name, role, email, status")
            .eq("id", user.id)
            .single()

        if (profileError || !profile) {
            return jsonResponse({ error: "User profile not found" }, 403)
        }
        if (["pending", "declined", "blocked"].includes(profile.status)) {
            return jsonResponse({ error: "Account is not authorized to join live classes" }, 403)
        }

        const body = await req.json()
        const roomName = typeof body?.roomName === "string" ? body.roomName.trim() : ""
        const roomMatch = roomName.match(/^Learnova_LiveClass_([0-9a-f-]{36})$/i)
        if (!roomMatch) return jsonResponse({ error: "Invalid classroom roomName" }, 400)

        const isModerator = ["organizer", "main_admin", "sub_admin"].includes(profile.role)
        const { data: video, error: videoError } = await supabase
            .from("videos").select("id, course_id").eq("id", roomMatch[1]).maybeSingle()
        if (videoError || !video) return jsonResponse({ error: "Classroom not found" }, 404)

        if (!isModerator) {
            const { data: enrollment, error: enrollmentError } = await supabase
                .from("enrollments").select("id")
                .eq("course_id", video.course_id).eq("student_id", user.id).maybeSingle()
            if (enrollmentError || !enrollment) {
                return jsonResponse({ error: "You are not enrolled in this course" }, 403)
            }
        }

        const appId = Deno.env.get("JAAS_APP_ID")
        const kid = Deno.env.get("JAAS_KID")
        const privateKey = Deno.env.get("JAAS_PRIVATE_KEY")
        if (!appId || !kid || !privateKey) {
            throw new Error("Missing JaaS credentials in environment")
        }

        // Never trust a moderator flag, display name, or email supplied by the browser.
        const now = Math.floor(Date.now() / 1000)
        const payload: Record<string, any> = {
            aud: "jitsi",
            iss: "chat",
            sub: appId,
            room: roomName,
            exp: now + 14400,
            nbf: now - 10,
            context: {
                user: {
                    name: profile.name || user.email?.split("@")[0] || "Student",
                    email: profile.email || user.email || "",
                },
                features: {
                    livestreaming: true,
                    recording: isModerator,
                    transcription: isModerator,
                    "outbound-call": false,
                },
            },
        }

        if (isModerator) {
            payload.context.user.moderator = "true"
        }

        const normalizedPrivateKey = privateKey.replace(/\\n/g, "\n")
        const token = jwt.sign(payload, normalizedPrivateKey, {
            algorithm: "RS256",
            header: { kid, typ: "JWT", alg: "RS256" },
        })

        return jsonResponse({ token }, 200)
    } catch (error) {
        console.error("JaaS token generation failed:", error)
        return jsonResponse(
            { error: error instanceof Error ? error.message : "Unable to generate meeting token" },
            500,
        )
    }
})
