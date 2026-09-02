import { supabase } from './supabase'

/**
 * Base64URL encode string or Uint8Array
 */
function base64UrlEncode(data) {
    let str = ''
    if (typeof data === 'string') {
        str = btoa(unescape(encodeURIComponent(data)))
    } else {
        const bytes = new Uint8Array(data)
        let binary = ''
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        str = btoa(binary)
    }
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generate HMAC-SHA256 LiveKit JWT Token locally using native Web Crypto
 */
async function generateLocalLiveKitToken({ roomName, identity, name, role = 'student', isOrganizer = false, proctoringMode = false }) {
    const apiKey = import.meta.env.VITE_LIVEKIT_API_KEY
    const apiSecret = import.meta.env.VITE_LIVEKIT_API_SECRET

    if (!apiKey || !apiSecret) {
        throw new Error('Missing VITE_LIVEKIT_API_KEY or VITE_LIVEKIT_API_SECRET in environment')
    }

    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'HS256', typ: 'JWT' }

    const isModerator = isOrganizer || ['organizer', 'main_admin', 'sub_admin'].includes(role)
    const displayName = name || (isModerator ? 'Instructor' : 'Student')
    const userId = identity || (isModerator ? `organizer_${now}` : `student_${now}`)

    const payload = {
        name: displayName,
        iss: apiKey,
        sub: userId,
        nbf: now,
        exp: now + 21600, // 6 hours validity
        video: {
            roomJoin: true,
            room: roomName,
            canPublish: proctoringMode ? !isModerator : true,
            canSubscribe: proctoringMode ? isModerator : true,
            canPublishData: true,
            canUpdateOwnMetadata: true,
            roomAdmin: isModerator,
            roomCreate: isModerator
        },
        metadata: JSON.stringify({
            userId,
            name: displayName,
            role: role || (isModerator ? 'organizer' : 'student')
        })
    }

    if (proctoringMode) {
        if (isModerator) {
            payload.video.canPublish = false
            payload.video.canSubscribe = true
        } else {
            payload.video.canPublish = true
            payload.video.canSubscribe = false
        }
    }

    const encodedHeader = base64UrlEncode(JSON.stringify(header))
    const encodedPayload = base64UrlEncode(JSON.stringify(payload))
    const unsignedToken = `${encodedHeader}.${encodedPayload}`

    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(apiSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    )

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        enc.encode(unsignedToken)
    )

    const encodedSignature = base64UrlEncode(signature)
    return `${unsignedToken}.${encodedSignature}`
}

/**
 * Fetch LiveKit Token: generates locally using project credentials, or falls back to Edge Function
 */
export async function getLiveKitToken({ roomName, identity, name, role, isOrganizer, proctoringMode = false }) {
    const apiKey = import.meta.env.VITE_LIVEKIT_API_KEY
    const apiSecret = import.meta.env.VITE_LIVEKIT_API_SECRET

    // 1. If project credentials exist in .env, use them directly to guarantee matching keys
    if (apiKey && apiSecret) {
        return await generateLocalLiveKitToken({
            roomName,
            identity,
            name,
            role,
            isOrganizer,
            proctoringMode
        })
    }

    // 2. Fallback to Supabase Edge Function if .env keys are not provided
    try {
        const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: { roomName, proctoringMode }
        })
        if (!error && data?.token) {
            return data.token
        }
    } catch (err) {
        console.warn('Edge Function livekit-token failed:', err)
    }

    throw new Error('LiveKit credentials missing in environment')
}
