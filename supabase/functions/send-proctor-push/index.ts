import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import webpush from "npm:web-push@3.6.7"
import { initializeApp, cert } from "npm:firebase-admin@12.1.0/app"
import { getMessaging } from "npm:firebase-admin@12.1.0/messaging"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

let firebaseApp: any = null;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const payload = await req.json()
        const record = payload.record

        if (!record || !record.student_name) {
            return new Response('Skipped', { status: 200, headers: corsHeaders })
        }

        // 1. Setup Web Push Credentials
        if (Deno.env.get('VAPID_PUBLIC_KEY') && Deno.env.get('VAPID_PRIVATE_KEY')) {
            webpush.setVapidDetails(
                'mailto:admin@example.com',
                Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
                Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
            )
        }

        // 2. Setup Firebase Admin SDK Credentials
        const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
        if (serviceAccountStr && !firebaseApp) {
            try {
                const serviceAccount = JSON.parse(serviceAccountStr)
                firebaseApp = initializeApp({
                    credential: cert(serviceAccount)
                });
            } catch (e) {
                console.error("Firebase init failed:", e)
            }
        }

        const { data: subscriptions, error } = await supabaseAdmin
            .from('push_subscriptions')
            .select('subscription')

        if (error) throw error

        const webPayload = JSON.stringify({
            title: 'Coding Practice Started',
            body: `${record.student_name} has just started a coding practice session!`,
            url: '/organizer/proctoring'
        })

        const promises = subscriptions.map((row: any) => {
            const sub = row.subscription;
            if (!sub) return Promise.resolve();

            // Native Android FCM
            if (sub.type === 'fcm' && sub.token) {
                if (!firebaseApp) {
                    console.error("Skipping FCM push: FIREBASE_SERVICE_ACCOUNT not configured.");
                    return Promise.resolve();
                }
                const message = {
                    token: sub.token,
                    notification: {
                        title: 'Coding Practice Started',
                        body: `${record.student_name} has just started a coding practice session!`
                    },
                    data: { route: '/organizer/proctoring' }
                };
                return getMessaging().send(message).catch((e: any) => console.error("FCM Push failed:", e));
            } 
            
            // Web Push
            if (sub.type === 'web' && sub.data) {
                return webpush.sendNotification(sub.data, webPayload).catch((e: any) => console.error("Web Push failed:", e));
            }
            
            // Backwards compat for testing
            if (sub.endpoint) {
                return webpush.sendNotification(sub, webPayload).catch((e: any) => console.error("Web Push fallback failed:", e));
            }
            
            return Promise.resolve();
        });

        await Promise.all(promises)

        return new Response(JSON.stringify({ success: true, sent: subscriptions.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
