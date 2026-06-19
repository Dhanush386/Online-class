// Shared ICE server configuration for WebRTC connections.
// Using free public STUN/TURN servers to penetrate mobile Symmetric NATs.

export const ICE_SERVERS = [
    // Standard STUN servers (works for Wi-Fi)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    
    // Free Public TURN Relay Server (Required for Mobile Data / 4G / LTE)
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    },
    {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
]

export async function getIceServers() {
    return ICE_SERVERS;
}
