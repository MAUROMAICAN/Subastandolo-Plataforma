import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Get a Google OAuth2 access token from the service account credentials */
async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FCM_CLIENT_EMAIL")!;
  const privateKeyPem = Deno.env.get("FCM_PRIVATE_KEY")!
    .replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payload = btoa(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const encoder = new TextEncoder();
  const data = encoder.encode(`${header}.${payload}`);

  const pemContents = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

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
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

/** Map tag to Android notification channel — MUST match IDs in MainActivity.java */
function getChannelId(tag: string): string {
  switch (tag) {
    case "outbid":
    case "new_bid":
    case "urgent":
      return "subastandolo_bids_v4";
    case "auction_won":
    case "auction_finalized":
    case "payment_verified":
      return "subastandolo_wins_v4";
    case "admin_custom":
    case "admin_notification":
    case "promo":
    case "announcement":
    case "maintenance":
      return "subastandolo_admin_v4";
    default:
      return "subastandolo_admin_v4";
  }
}

/** Map tag to sound file name in res/raw/ (without extension) */
function getSoundName(tag: string): string {
  switch (tag) {
    case "outbid":
    case "urgent":
      return "sobrepuja";
    case "new_bid":
      return "pujando";
    case "auction_won":
    case "auction_finalized":
    case "payment_verified":
      return "campanita";
    case "admin_custom":
    case "admin_notification":
    case "promo":
    case "announcement":
    case "maintenance":
      return "administrador";
    default:
      return "campanita";
  }
}

/** Send push via FCM HTTP v1 API — optimized for maximum visibility on Android */
async function sendFCM(
  token: string,
  title: string,
  body: string,
  url: string,
  tag: string,
  accessToken: string,
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  const channelId = getChannelId(tag);
  const soundName = getSoundName(tag);

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          // ── Notification (visible in tray) ──
          notification: { title, body },
          // ── Data payload (always delivered, even in background/killed) ──
          data: {
            url,
            tag,
            channel_id: channelId,
            sound: soundName,
            title,
            body,
            click_action: "FLUTTER_NOTIFICATION_CLICK",
            // Flags the app can read to wake screen / vibrate
            wake_screen: "true",
            vibrate: "true",
            priority: "max",
          },
          android: {
            // HIGH priority = wakes dozing device immediately
            priority: "high",
            // 0s TTL = deliver immediately, don't batch
            ttl: "0s",
            notification: {
              channel_id: channelId,
              sound: soundName,
              icon: "notification_icon",
              // Disable defaults so our custom values take effect
              default_sound: false,
              default_vibrate_timings: false,
              default_light_settings: false,
              // Custom vibration pattern
              vibrate_timings: ["0s", "0.3s", "0.15s", "0.3s", "0.15s", "0.3s"],
              // LED light for devices that support it
              light_settings: {
                color: { red: 0.0, green: 0.8, blue: 1.0, alpha: 1.0 },
                light_on_duration: "0.5s",
                light_off_duration: "1s",
              },
              // Maximum priority = heads-up notification
              notification_priority: "PRIORITY_MAX",
              visibility: "PUBLIC",
              // Ticker text shown in status bar
              ticker: `${title}: ${body}`,
            },
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`FCM error for token ${token.substring(0, 20)}...: ${err}`);
    return { success: false, error: err };
  }
  return { success: true };
}

/** Send Web Push notification */
async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  title: string,
  body: string,
  url: string,
  tag: string,
): Promise<{ success: boolean; error?: string }> {
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

  try {
    const { default: webpush } = await import("npm:web-push@3.6.7");

    webpush.setVapidDetails(
      "mailto:admin@subastandolo.com",
      vapidPublicKey,
      vapidPrivateKey,
    );

    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify({ title, body, url, tag, icon: "/icons/notification-icon.png" }),
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth guard: admin or service role ──
  const { isServiceRoleOrAdmin, unauthorized } = await import("../_shared/auth.ts");
  if (!await isServiceRoleOrAdmin(req)) {
    return unauthorized(corsHeaders);
  }

  try {
    const { user_id, user_ids, title, body, url, tag } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Determine target user IDs
    const targetIds: string[] = user_ids
      ? user_ids
      : user_id
        ? [user_id]
        : [];

    if (targetIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No user_id or user_ids provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get all push subscriptions for target users
    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetIds);

    if (subsError) {
      throw new Error(`Failed to fetch subscriptions: ${subsError.message}`);
    }

    if (!subs || subs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const projectId = Deno.env.get("FCM_PROJECT_ID")!;
    let accessToken: string | null = null;
    const results: { platform: string; success: boolean; error?: string }[] = [];
    const staleIds: string[] = [];

    for (const sub of subs) {
      // Determine FCM token — the app saves it as endpoint="fcm:TOKEN"
      const fcmToken = sub.fcm_token || (sub.endpoint?.startsWith("fcm:") ? sub.endpoint.replace("fcm:", "") : null);
      const isAndroid = sub.platform === "android" || (sub.endpoint?.startsWith("fcm:") && !sub.endpoint.includes("https://"));

      if (isAndroid && fcmToken) {
        // FCM for Android native
        if (!accessToken) {
          accessToken = await getAccessToken();
        }
        const result = await sendFCM(
          fcmToken, title, body, url || "/", tag || "general",
          accessToken, projectId,
        );
        results.push({ platform: "android", ...result });

        // If token is unregistered, mark for deletion
        if (!result.success && result.error?.includes("UNREGISTERED")) {
          staleIds.push(sub.id);
        }
      } else if (sub.platform === "web" && sub.endpoint) {
        // Web Push
        const result = await sendWebPush(
          sub.endpoint, sub.p256dh!, sub.auth!,
          title, body, url || "/", tag || "general",
        );
        results.push({ platform: "web", ...result });

        // If subscription expired, mark for deletion
        if (!result.success && (result.error?.includes("410") || result.error?.includes("expired"))) {
          staleIds.push(sub.id);
        }
      }
    }

    // Clean up stale subscriptions
    if (staleIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", staleIds);
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`Push results: ${sent} sent, ${failed} failed, ${staleIds.length} stale removed for ${targetIds.length} users`);

    return new Response(
      JSON.stringify({ sent, failed, stale_removed: staleIds.length, details: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("send-push error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
