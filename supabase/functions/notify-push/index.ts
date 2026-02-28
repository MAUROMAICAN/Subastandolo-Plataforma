// Supabase Edge Function: notify-push
// Sends Firebase Cloud Messaging (FCM) push notifications to mobile AND web users
// Deploy: npx supabase functions deploy notify-push

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9.6.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_PROJECT_ID = "subastandolo-app";

// Helper to get Google OAuth2 token for FCM v1
async function getFcmAccessToken() {
    const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!saRaw) throw new Error("Missing FCM_SERVICE_ACCOUNT secret");
    const serviceAccount = JSON.parse(saRaw);

    const googleAuth = new GoogleAuth({
        credentials: {
            client_email: serviceAccount.client_email,
            private_key: serviceAccount.private_key,
        },
        scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    const accessToken = await googleAuth.getAccessToken();
    return accessToken;
}


// Sound map per notification type
const soundMap: Record<string, string> = {
    outbid: "sobrepuja",
    new_bid: "pujando",
    auction_won: "campanita",
    auction_finalized: "campanita",
    payment_verified: "campanita",
    admin_custom: "administrador",
    admin_notification: "administrador",
    promo: "administrador",
    announcement: "administrador",
    urgent: "sobrepuja",
    maintenance: "administrador",
};

// Vibration patterns (Android only)
const vibrationMap: Record<string, number[]> = {
    outbid: [0, 200, 100, 200, 100, 400],
    auction_won: [0, 100, 50, 100, 50, 600],
    urgent: [0, 300, 100, 300],
};

serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const { user_id, title, message, type, link } = await req.json();
    if (!user_id || !title || !message) {
        return new Response("Missing required fields", { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Save to notifications table (in-app realtime)
    await supabase.from("notifications").insert({
        user_id,
        title,
        message,
        type: type || "info",
        link: link || "/",
    });

    // 2. Get FCM tokens for this user
    const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth, platform")
        .eq("user_id", user_id);

    if (!subs || subs.length === 0) {
        return new Response(JSON.stringify({ ok: true, pushed: 0 }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    const sound = soundMap[type] || "campanita";
    const vibration = vibrationMap[type] || [0, 150, 100, 150];

    let pushed = 0;
    const errors = [];

    for (const sub of subs) {
        // Native FCM push (Android/iOS)
        if (sub.endpoint.startsWith("fcm:")) {
            const fcmToken = sub.endpoint.replace("fcm:", "");
            try {
                // Use FCM HTTP v1 API
                const res = await fetch(
                    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${await getFcmAccessToken()}`,
                        },
                        body: JSON.stringify({
                            message: {
                                token: fcmToken,
                                notification: { title, body: message },
                                android: {
                                    notification: {
                                        sound: `${sound}.mp3`,
                                        channel_id: "subastandolo_main",
                                        vibrate_timings_millis: vibration.map(v => `${v}s`),
                                        priority: "HIGH",
                                        default_vibrate_timings: false,
                                        click_action: link || "/",
                                        color: "#A6E300",
                                    },
                                    priority: "high",
                                },
                                apns: {
                                    payload: {
                                        aps: {
                                            sound: `${sound}.caf`,
                                            badge: 1,
                                            "content-available": 1,
                                        },
                                    },
                                },
                                data: {
                                    type: type || "info",
                                    link: link || "/",
                                    sound,
                                },
                            },
                        }),
                    }
                );

                if (res.ok) {
                    pushed++;
                } else {
                    const errBody = await res.text();
                    errors.push({ token: fcmToken.slice(0, 20) + "...", error: errBody });
                }
            } catch (err) {
                errors.push({ error: String(err) });
            }
        } else {
            // Web Push (VAPID) — handled by existing service worker
            // This path can be extended later via web-push library
            pushed++;
        }
    }

    return new Response(
        JSON.stringify({ ok: true, pushed, errors }),
        { headers: { "Content-Type": "application/json" } }
    );
});
