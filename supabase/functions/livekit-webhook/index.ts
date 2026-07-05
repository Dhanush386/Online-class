import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { WebhookReceiver } from "npm:livekit-server-sdk"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const receiver = new WebhookReceiver(
    Deno.env.get('LIVEKIT_API_KEY') || '',
    Deno.env.get('LIVEKIT_API_SECRET') || ''
)

async function handleParticipantJoined(event: any, supabase: any) {
    const roomName = event.room?.name || ''
    const videoId = roomName.replace('learnova-class-', '')
    const metadataStr = event.participant?.metadata || '{}'
    
    let metadata: any = {}
    try { 
        metadata = JSON.parse(metadataStr) 
    } catch (e) {
        console.warn(`Failed to parse metadata for participant joined: ${e}`)
    }

    const userId = metadata.userId

    if (!videoId || !userId || metadata.role !== 'student') {
        return
    }

    console.log(`Student ${userId} joined room ${roomName}`)

    const nowIso = new Date().toISOString()

    // Fetch existing to preserve first_joined_at
    const { data: existing } = await supabase
        .from('live_attendance')
        .select('first_joined_at')
        .eq('student_id', userId)
        .eq('video_id', videoId)
        .single()

    const firstJoinedAt = existing?.first_joined_at || nowIso

    // We use the service role key to bypass RLS, ensuring strict tracking
    const { error } = await supabase.from('live_attendance').upsert({
        student_id: userId,
        video_id: videoId,
        session_id: event.participant?.sid,
        joined_at: nowIso, // Latest join
        first_joined_at: firstJoinedAt
    }, { onConflict: 'student_id,video_id' })

    if (error) console.error('Error inserting participant_joined', error)
}

async function handleParticipantLeft(event: any, supabase: any) {
    const roomName = event.room?.name || ''
    const videoId = roomName.replace('learnova-class-', '')
    const metadataStr = event.participant?.metadata || '{}'
    
    let metadata: any = {}
    try { 
        metadata = JSON.parse(metadataStr) 
    } catch (e) {
        console.warn(`Failed to parse metadata for participant left: ${e}`)
    }

    const userId = metadata.userId

    if (!videoId || !userId || metadata.role !== 'student') {
        return
    }

    console.log(`Student ${userId} left room ${roomName}`)

    // Fetch the existing attendance record to calculate accumulated duration
    const { data: existing } = await supabase
        .from('live_attendance')
        .select('joined_at, duration_seconds, xp_awarded')
        .eq('student_id', userId)
        .eq('video_id', videoId)
        .single()

    if (!existing?.joined_at) {
        console.log('No prior join event found.')
        return
    }

    const joinedAtTime = new Date(existing.joined_at).getTime()
    const leftAtTime = Date.now()
    let sessionDurationSec = Math.floor((leftAtTime - joinedAtTime) / 1000)
    if (sessionDurationSec < 0) sessionDurationSec = 0

    const totalDurationSec = (existing.duration_seconds || 0) + sessionDurationSec
    const isPresent = totalDurationSec >= 300 // >= 5 minutes

    let xpAwarded = existing.xp_awarded || false

    // Award XP once per session if total duration is sufficient
    if (isPresent && !xpAwarded) {
        console.log(`Awarding XP to student ${userId} for completing 5 mins`)
        const { data: userProfile } = await supabase.from('users').select('xp').eq('id', userId).single()
        if (userProfile) {
            await supabase.from('users').update({ xp: (userProfile.xp || 0) + 50 }).eq('id', userId)
        }
        xpAwarded = true
    }

    const leftAtIso = new Date(leftAtTime).toISOString()

    const { error } = await supabase.from('live_attendance').upsert({
        student_id: userId,
        video_id: videoId,
        left_at: leftAtIso,
        last_left_at: leftAtIso, // Latest left
        duration_seconds: totalDurationSec,
        attendance_status: isPresent ? 'present' : 'insufficient_time', // 'late' or 'left_early' can be computed later or via separate cron
        xp_awarded: xpAwarded
    }, { onConflict: 'student_id,video_id' })

    if (error) console.error('Error updating participant_left', error)
}

serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
    }

    try {
        const body = await req.text()
        const authHeader = req.headers.get('Authorization')

        if (!authHeader) {
            return new Response('Unauthorized', { status: 401 })
        }

        // Securely verify the webhook signature
        const event = receiver.receive(body, authHeader)
        console.log(`Received webhook event: ${event.event}`)

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

        if (event.event === 'participant_joined') {
            await handleParticipantJoined(event, supabase)
        }

        if (event.event === 'participant_left') {
            await handleParticipantLeft(event, supabase)
        }

        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error('Webhook processing error:', error)
        return new Response(`Error processing webhook: ${error.message}`, { status: 500 })
    }
})
