import { useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ─── Sound map ─────────────────────────────────────────────────────────────
const soundMap: Record<string, string> = {
  outbid: "/sounds/sobrepuja.mp3",
  new_bid: "/sounds/pujando.mp3",
  auction_won: "/sounds/campanita.mp3",
  auction_finalized: "/sounds/campanita.mp3",
  payment_verified: "/sounds/campanita.mp3",
  autobid_exhausted: "/sounds/campanita.mp3",
  admin_custom: "/sounds/administrador.mp3",
  admin_notification: "/sounds/administrador.mp3",
  promo: "/sounds/administrador.mp3",
  announcement: "/sounds/administrador.mp3",
  urgent: "/sounds/sobrepuja.mp3",
  maintenance: "/sounds/administrador.mp3",
};

const playSound = (notifType: string) => {
  // Guard: only play for real notification types, never on mount
  if (!notifType || notifType === "info" || !soundMap[notifType]) return;
  try {
    const url = soundMap[notifType];
    const audio = new Audio(url);
    audio.volume = 0.8;
    // Only play if we are in a user interaction context or background delivery
    audio.play().catch(() => { /* silently ignore autoplay policy denials */ });
  } catch { }
};

// ─── Native FCM via Capacitor ───────────────────────────────────────────────
async function initNativePush(userId: string) {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // !! IMPORTANT: Add ALL listeners BEFORE calling register().
    // On Android, if the FCM token is already cached, the 'registration'
    // event fires synchronously inside register() — before any later
    // addListener() call would have a chance to catch it.

    // Get FCM token and save to Supabase
    PushNotifications.addListener("registration", async (token) => {
      console.log("[FCM] Token:", token.value);
      const endpoint = `fcm:${token.value}`;

      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("endpoint", endpoint)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("push_subscriptions").insert({
          user_id: userId,
          endpoint,
          p256dh: "",
          auth: "",
          platform: Capacitor.getPlatform(),
        } as any);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[FCM] Registration error:", err);
    });

    // Handle foreground notifications (app is open)
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("[FCM] Foreground notification:", notification);
      const notifType = (notification.data?.type as string) || "info";
      playSound(notifType);

      // Vibrate if available
      if ("vibrate" in navigator) {
        const patterns: Record<string, number[]> = {
          outbid: [200, 100, 200, 100, 400],
          auction_won: [100, 50, 100, 50, 600],
          urgent: [300, 100, 300],
        };
        navigator.vibrate(patterns[notifType] || [150, 100, 150]);
      }
    });

    // Handle tap on notification (app was in background/killed)
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[FCM] Action performed:", action);
      const link = action.notification.data?.link;
      if (link) {
        window.location.href = link;
      }
    });

    // ── Now request permission and register AFTER all listeners are set ──
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") {
      console.warn("[FCM] Permission denied");
      return;
    }

    // register() may synchronously emit 'registration' if token is cached,
    // so it MUST come after addListener() calls above.
    await PushNotifications.register();

  } catch (err) {
    console.error("[FCM] Native push init failed:", err);
  }
}

// ─── Web Push via VAPID ─────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function initWebPush(userId: string) {
  const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[WebPush] No VAPID key configured");
    return;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
    }

    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint!;
    const p256dh = subJson.keys!.p256dh!;
    const auth = subJson.keys!.auth!;

    const { data: existing } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from("push_subscriptions").insert({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        platform: "web",
      } as any);
    }

    console.log("[WebPush] Registered successfully");
  } catch (err) {
    console.error("[WebPush] Registration failed:", err);
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function usePushNotifications() {
  const { user } = useAuth();

  const play = useCallback(playSound, []);

  useEffect(() => {
    if (!user) return;

    if (Capacitor.isNativePlatform()) {
      // Mobile app → use native FCM
      initNativePush(user.id);
    } else {
      // Web browser → use Web Push
      initWebPush(user.id);
    }
  }, [user]);

  // Listen for SW messages (web push sound while app is focused)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PLAY_NOTIFICATION_SOUND") {
        const type = event.data.notifType || "info";
        play(type);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [play]);

  return { playNotificationSound: play };
}
