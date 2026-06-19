// Metered.ca Free TURN Server Configuration
// Sign up at https://dashboard.metered.ca/signup?tool=turnserver (free, 20GB/month)
// Then replace the values below with your app name and API key from the dashboard.

const METERED_APP_NAME = 'YOUR_APP_NAME'   // e.g. 'myapp' from myapp.metered.live
const METERED_API_KEY  = 'YOUR_API_KEY'    // from your Metered dashboard

// Fallback STUN-only servers (used if TURN fetch fails)
const FALLBACK_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
]

/**
 * Fetches ICE servers (STUN + TURN) from Metered.ca's free API.
 * Returns TURN relay servers that work on mobile 4G/LTE networks.
 * Falls back to STUN-only if the API key is not configured or the fetch fails.
 */
export async function getIceServers() {
    if (METERED_APP_NAME === 'YOUR_APP_NAME' || METERED_API_KEY === 'YOUR_API_KEY') {
        console.warn('[ICE] Metered.ca not configured. Using STUN-only (live stream will NOT work on mobile 4G/LTE).')
        return FALLBACK_ICE_SERVERS
    }

    try {
        const response = await fetch(
            `https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
        )
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const iceServers = await response.json()
        console.log('[ICE] Fetched TURN credentials from Metered.ca:', iceServers.length, 'servers')
        return iceServers
    } catch (err) {
        console.error('[ICE] Failed to fetch TURN credentials, falling back to STUN-only:', err)
        return FALLBACK_ICE_SERVERS
    }
}

// Re-export fallback for backwards compatibility
export const ICE_SERVERS = FALLBACK_ICE_SERVERS
