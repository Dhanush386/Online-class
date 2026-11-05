import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { SignJWT } from "https://deno.land/x/jose@v4.15.4/index.ts"

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
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405)

    try {
        const authHeader = req.headers.get("Authorization")
        const jwtToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]
        if (!authHeader || !jwtToken) return jsonResponse({ error: "Authentication required" }, 401)

        const supabaseUrl = Deno.env.get("SUPABASE_URL")
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
        if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase environment is not configured")

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
            auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken)
        if (authError || !user) return jsonResponse({ error: "Invalid or expired session" }, 401)

        const { data: profile, error: profileError } = await supabase
            .from("users").select("name, role, email, status").eq("id", user.id).single()
        if (profileError || !profile) return jsonResponse({ error: "User profile not found" }, 403)
        if (["pending", "declined", "blocked"].includes(profile.status)) {
            return jsonResponse({ error: "Account is not authorized to join live classes" }, 403)
        }

        const body = await req.json()
        const roomName = typeof body?.roomName === "string" ? body.roomName.trim() : ""
        const classMatch = roomName.match(/^learnova-class-([0-9a-f-]{36})$/i)
        const assessmentMatch = roomName.match(/^assessment-([0-9a-f-]{36})$/i)
        if (!classMatch && !assessmentMatch) return jsonResponse({ error: "Invalid classroom roomName" }, 400)

        const isOrganizer = ["organizer", "main_admin", "sub_admin"].includes(profile.role)
        let courseId: string | null = null

        if (classMatch) {
            const { data: video, error } = await supabase
                .from("videos").select("id, course_id").eq("id", classMatch[1]).maybeSingle()
            if (error || !video) return jsonResponse({ error: "Classroom not found" }, 404)
            courseId = video.course_id
        } else {
            const { data: assessment, error } = await supabase
                .from("assessments").select("id, course_id").eq("id", assessmentMatch![1]).maybeSingle()
            if (error || !assessment) return jsonResponse({ error: "Assessment room not found" }, 404)
            courseId = assessment.course_id
        }

        if (!isOrganizer) {
            const { data: enrollment, error } = await supabase
                .from("enrollments").select("id")
                .eq("course_id", courseId).eq("student_id", user.id).maybeSingle()
            if (error || !enrollment) {
                return jsonResponse({ error: "You are not enrolled in this course" }, 403)
            }
        }

        const apiKey = Deno.env.get("LIVEKIT_API_KEY")
        const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")
        if (!apiKey || !apiSecret) throw new Error("Missing LiveKit credentials in environment")

        const userName = profile.name || user.email?.split("@")[0] || (isOrganizer ? "Instructor" : "Student")
        const proctoringMode = body?.proctoringMode === true
        const videoPermissions: Record<string, unknown> = {
            roomJoin: true, room: roomName, canPublish: true, canSubscribe: true,
            canPublishData: true, canUpdateOwnMetadata: true,
        }
        if (proctoringMode && isOrganizer) {
            videoPermissions.canPublish = false
        } else if (proctoringMode && !isOrganizer) {
            videoPermissions.canSubscribe = false
        }
        if (isOrganizer) {
            videoPermissions.roomAdmin = true
            videoPermissions.roomCreate = true
        }

        const now = Math.floor(Date.now() / 1000)
        const token = await new SignJWT({
            name: userName,
            video: videoPermissions,
            metadata: JSON.stringify({
                userId: user.id, name: userName, role: profile.role,
                email: profile.email || user.email || "",
            }),
        })
            .setProtectedHeader({ alg: "HS256", typ: "JWT" })
            .setIssuer(apiKey)
            .setSubject(user.id)
            .setNotBefore(now)
            .setExpirationTime(now + 21600)
            .sign(new TextEncoder().encode(apiSecret))

        return jsonResponse({ token }, 200)
    } catch (error) {
        console.error("LiveKit token generation failed:", error)
        return jsonResponse(
            { error: error instanceof Error ? error.message : "Unable to generate classroom token" },
            500,
        )
    }
})
