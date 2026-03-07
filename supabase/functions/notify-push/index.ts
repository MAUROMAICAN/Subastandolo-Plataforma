// Supabase Edge Function: notify-push
// Sends Firebase Cloud Messaging (FCM) push notifications to mobile AND web users
// Deploy: npx supabase functions deploy notify-push --project-ref oqjwrrttncfcznhmzlrk --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_PROJECT_ID = "subastandolo-app";

// ── Google OAuth2 token for FCM v1 ──────────────────────────────────────────
async function getFcmAccessToken() {
    const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!saRaw) throw new Error("Missing FCM_SERVICE_ACCOUNT secret");
    const sa = JSON.parse(saRaw);

    const now = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const payload = btoa(JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
    })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const encoder = new TextEncoder();
    const data = encoder.encode(`${header}.${payload}`);

    const pemContents = sa.private_key
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\s/g, "");
    const binaryKey = Uint8Array.from(atob(pemContents), (c: string) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
        "pkcs8",
        binaryKey,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"],
    );

    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const jwt = `${header}.${payload}.${sig}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
        throw new Error(`FCM auth failed: ${JSON.stringify(tokenData)}`);
    }
    return tokenData.access_token as string;
}

// ── Sound map ───────────────────────────────────────────────────────────────
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
    payment_reminder: "sobrepuja",
};

// ── Channel map — MUST match IDs in MainActivity.java ───────────────────────
const channelMap: Record<string, string> = {
    outbid: "subastandolo_bids_v4",
    new_bid: "subastandolo_bids_v4",
    auction_won: "subastandolo_wins_v4",
    auction_finalized: "subastandolo_wins_v4",
    payment_verified: "subastandolo_wins_v4",
    admin_custom: "subastandolo_admin_v4",
    admin_notification: "subastandolo_admin_v4",
    promo: "subastandolo_admin_v4",
    announcement: "subastandolo_admin_v4",
    urgent: "subastandolo_bids_v4",
    maintenance: "subastandolo_admin_v4",
    payment_reminder: "subastandolo_bids_v4",
};

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: corsHeaders,
        });
    }

    try {
        const { user_id, title, message, type, link } = await req.json();
        console.log(`[notify-push] Received: user=${user_id}, type=${type}, title=${title}`);

        if (!user_id || !title || !message) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // 1. Save to notifications table (in-app realtime)
        const { error: insertError } = await supabase.from("notifications").insert({
            user_id,
            title,
            message,
            type: type || "info",
            link: link || "/",
        });
        if (insertError) {
            console.error("[notify-push] Insert notification error:", insertError.message);
        }

        // 2. Get push subscriptions for this user
        const { data: subs, error: subsError } = await supabase
            .from("push_subscriptions")
            .select("id, endpoint, p256dh, auth, platform, fcm_token")
            .eq("user_id", user_id);

        if (subsError) {
            console.error("[notify-push] Query subs error:", subsError.message);
        }

        if (!subs || subs.length === 0) {
            console.log("[notify-push] No push subscriptions found for user:", user_id);
            return new Response(
                JSON.stringify({ ok: true, pushed: 0, reason: "no_subscriptions" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
        }

        console.log(`[notify-push] Found ${subs.length} subscriptions for user ${user_id}`);

        const sound = soundMap[type] || "administrador";
        const channelId = channelMap[type] || "subastandolo_admin_v4";

        let pushed = 0;
        const errors: any[] = [];
        let accessToken: string | null = null;

        for (const sub of subs) {
            // Determine FCM token — app saves as endpoint="fcm:TOKEN"
            const fcmToken = sub.fcm_token || (sub.endpoint?.startsWith("fcm:") ? sub.endpoint.replace("fcm:", "") : null);
            const isNative = sub.platform === "android" || sub.platform === "ios" ||
                (sub.endpoint?.startsWith("fcm:") && !sub.endpoint.includes("https://"));

            if (isNative && fcmToken) {
                console.log(`[notify-push] Sending FCM to ${sub.platform} token: ${fcmToken.substring(0, 20)}...`);
                try {
                    if (!accessToken) {
                        accessToken = await getFcmAccessToken();
                        console.log("[notify-push] Got FCM access token successfully");
                    }

                    const fcmPayload = {
                        message: {
                            token: fcmToken,
                            notification: {
                                title,
                                body: message,
                            },
                            android: {
                                priority: "high" as const,
                                ttl: "0s",
                                notification: {
                                    channel_id: channelId,
                                    sound: sound,
                                    default_sound: false,
                                    default_vibrate_timings: false,
                                    default_light_settings: false,
                                    vibrate_timings: ["0s", "0.3s", "0.15s", "0.3s", "0.15s", "0.3s"],
                                    notification_priority: "PRIORITY_MAX" as const,
                                    visibility: "PUBLIC" as const,
                                    ticker: `${title}: ${message}`,
                                },
                            },
                            data: {
                                title,
                                body: message,
                                type: type || "info",
                                link: link || "/",
                                sound,
                                channel_id: channelId,
                            },
                        },
                    };

                    const res = await fetch(
                        `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${accessToken}`,
                            },
                            body: JSON.stringify(fcmPayload),
                        },
                    );

                    const resBody = await res.text();
                    if (res.ok) {
                        pushed++;
                        console.log(`[notify-push] ✅ FCM sent OK: ${resBody}`);
                    } else {
                        console.error(`[notify-push] ❌ FCM error ${res.status}: ${resBody}`);
                        errors.push({ token: fcmToken.substring(0, 20), status: res.status, error: resBody });

                        // Clean up stale tokens
                        if (resBody.includes("UNREGISTERED") || resBody.includes("NOT_FOUND")) {
                            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                            console.log(`[notify-push] Deleted stale subscription ${sub.id}`);
                        }
                    }
                } catch (err) {
                    console.error(`[notify-push] FCM exception:`, err);
                    errors.push({ error: String(err) });
                }
            } else if (sub.endpoint?.startsWith("https://")) {
                // Web Push — skip for now, handled by service worker
                console.log("[notify-push] Skipping web push subscription");
            } else {
                console.log(`[notify-push] Unknown subscription type: platform=${sub.platform}, endpoint=${sub.endpoint?.substring(0, 30)}`);
            }
        }

        console.log(`[notify-push] Done: ${pushed} pushed, ${errors.length} errors`);
        return new Response(
            JSON.stringify({ ok: true, pushed, errors }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    } catch (err: any) {
        console.error("[notify-push] Fatal error:", err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
});
