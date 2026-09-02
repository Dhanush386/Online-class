# Learnova Meet — Self-Hosted LiveKit Deployment

> **Google Classroom + Google Meet + HackerRank + ChatGPT** — all under your own brand.

This guide walks you through deploying Learnova Meet on your own VPS in under 15 minutes.

---

## Prerequisites

- A VPS running **Ubuntu 22.04+** (minimum 4 vCPU, 8 GB RAM)
- A domain name pointing to your VPS (e.g., `meet.learnova.com`)
- SSH access to the VPS
- Docker and Docker Compose installed

---

## Step 1: Install Docker

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose
apt install docker-compose-plugin -y

# Verify
docker compose version
```

---

## Step 2: Generate LiveKit API Keys

```bash
docker run --rm livekit/generate
```

This will output an **API Key** and **API Secret**. Copy both — you'll need them for configuration.

---

## Step 3: Configure DNS

Point these DNS records to your VPS IP:

| Type | Name                     | Value         |
|------|--------------------------|---------------|
| A    | meet.learnova.com        | YOUR_VPS_IP   |
| A    | turn.meet.learnova.com   | YOUR_VPS_IP   |

---

## Step 4: Upload & Configure Files

```bash
# Create deployment directory
mkdir -p /opt/learnova-meet
cd /opt/learnova-meet

# Copy all files from deploy/livekit/ to this directory
# Then edit the configuration:
```

### Edit `livekit-config.yaml`
Replace the placeholder API key/secret with the ones you generated in Step 2:

```yaml
keys:
  YOUR_API_KEY: YOUR_API_SECRET
```

### Edit `turnserver.conf`
Replace `YOUR_VPS_PUBLIC_IP` with your actual VPS IP.

### Edit `Caddyfile`
Replace `meet.learnova.com` with your actual domain.

---

## Step 5: Launch the Stack

```bash
docker compose up -d
```

Caddy will automatically obtain SSL certificates from Let's Encrypt.

Verify everything is running:

```bash
docker compose ps
```

---

## Step 6: Configure Supabase Edge Function Secrets

Go to your [Supabase Dashboard](https://supabase.com/dashboard) → Edge Functions → Secrets.

Add:

| Secret Name         | Value                                    |
|---------------------|------------------------------------------|
| LIVEKIT_API_KEY     | Your generated API Key from Step 2       |
| LIVEKIT_API_SECRET  | Your generated API Secret from Step 2    |

Then deploy the Edge Function:

```bash
npx supabase functions deploy livekit-token --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

---

## Step 7: Configure Vercel / Frontend

Add these environment variables in your Vercel project settings:

| Variable                    | Value                          |
|-----------------------------|--------------------------------|
| VITE_LIVEKIT_URL            | wss://meet.learnova.com        |
| VITE_LIVE_CLASS_PROVIDER    | livekit                        |

Trigger a new deployment on Vercel.

---

## Step 8: Test!

1. Open Learnova as an **Organizer** and start a live class.
2. Open another browser/incognito window as a **Student** and join.
3. Verify: Video, Audio, Mute, Camera toggle, Screen share, Sidebar features.

---

## Rollback to Jitsi

If something goes wrong, instant rollback:

Change `VITE_LIVE_CLASS_PROVIDER` to `jitsi` in Vercel env vars and redeploy.

That's it. Your classes continue uninterrupted on Jitsi while you debug LiveKit.

---

## Architecture

```
Student/Organizer Browser
        ↓
  Supabase Auth (JWT validation)
        ↓
  Edge Function (livekit-token)
        ↓
  LiveKit Access Token
        ↓
  LiveKit Server (meet.learnova.com)
        ↓
  Coturn TURN (NAT traversal)
        ↓
  WebRTC Peer Connection
        ↓
  Native Learnova Meet UI
```

---

## Firewall Rules

Ensure these ports are open on your VPS:

| Port             | Protocol | Service        |
|------------------|----------|----------------|
| 80               | TCP      | HTTP (Caddy)   |
| 443              | TCP      | HTTPS (Caddy)  |
| 7880             | TCP      | LiveKit API    |
| 7881             | TCP      | LiveKit WebRTC |
| 3478             | TCP/UDP  | STUN/TURN      |
| 5349             | TCP/UDP  | TURNS (TLS)    |
| 49152-49200      | UDP      | TURN relay     |
| 50000-50100      | UDP      | WebRTC media   |

```bash
# UFW example
ufw allow 80,443,7880,7881,3478,5349/tcp
ufw allow 3478,5349/udp
ufw allow 49152:49200/udp
ufw allow 50000:50100/udp
ufw reload
```

---

## Monitoring

```bash
# View logs
docker compose logs -f livekit

# Check room status
curl https://meet.learnova.com/healthcheck
```
