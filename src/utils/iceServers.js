// Shared ICE server configuration for WebRTC connections.
// Using free Google and Twilio STUN servers for direct Peer-to-Peer connections.
// NOTE: Direct P2P often fails on mobile 4G/LTE networks due to Symmetric NAT.
export const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
]

export async function getIceServers() {
    return ICE_SERVERS;
}
