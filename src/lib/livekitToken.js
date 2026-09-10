import { supabase } from './supabase'

/**
 * Fetch LiveKit Token securely from server-side Supabase Edge Function.
 * The client NEVER holds or uses the LIVEKIT_API_SECRET.
 *
 * @param {Object} params
 * @param {string} params.roomName
 * @param {boolean} [params.proctoringMode=false]
 * @returns {Promise<string>} Signed LiveKit JWT
 */
export async function getLiveKitToken({ roomName, proctoringMode = false }) {
    if (!roomName) {
        throw new Error('roomName is required to fetch LiveKit token')
    }

    try {
        const { data, error } = await supabase.functions.invoke('livekit-token', {
            body: { roomName, proctoringMode }
        })

        if (error) {
            console.error('Edge Function livekit-token returned error:', error)
            throw new Error(error.message || 'Failed to authenticate LiveKit room access.')
        }

        if (data?.token) {
            return data.token
        }

        if (data?.error) {
            throw new Error(data.error)
        }
    } catch (err) {
        console.error('Error acquiring LiveKit token from server:', err)
        throw err
    }

    throw new Error('Unable to retrieve LiveKit token from server.')
}
