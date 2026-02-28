import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const { user } = useAuth();

  const playNotificationSound = useCallback((tag: string) => {
    const soundMap: Record<string, string> = {
      outbid: "/sounds/sobrepuja.mp3",
      new_bid: "/sounds/pujando.mp3",
      auction_won: "/sounds/notificacion.mp3",
      auction_finalized: "/sounds/campanita.mp3",
      payment_verified: "/sounds/campanita.mp3",
      autobid_exhausted: "/sounds/campanita.mp3",
      admin_custom: "/sounds/administrador.mp3",
      admin_notification: "/sounds/administrador.mp3",
      promo: "/sounds/administrador.mp3",
      announcement: "/sounds/administrador.mp3",
      urgent: "/sounds/administrador.mp3",
      maintenance: "/sounds/administrador.mp3",
    };
    const soundUrl = soundMap[tag] || "/sounds/campanita.mp3";
    try {
      const audio = new Audio(soundUrl);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch {
      // Ignore
    }
  }, []);

  // Web Push registration
  useEffect(() => {
    if (!user) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!VAPID_PUBLIC_KEY) {
      console.warn("[PUSH] VAPID_PUBLIC_KEY not set, skipping Web Push");
      return;
    }

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const reg = registration as any;
        let subscription = await reg.pushManager.getSubscription();

        if (!subscription) {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
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
          .eq("user_id", user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("push_subscriptions").insert({
            user_id: user.id, endpoint, p256dh, auth, platform: "web",
          } as any);
        }

        console.log("[PUSH] Web Push registered successfully");
      } catch (err) {
        console.error("[PUSH] Web Push registration failed:", err);
      }
    })();
  }, [user]);

  // Listen for SW messages (Web Push sound)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PLAY_NOTIFICATION_SOUND") {
        const tag = event.data.soundUrl?.includes("sobrepuja") ? "outbid"
          : event.data.soundUrl?.includes("pujando") ? "new_bid"
          : event.data.soundUrl?.includes("administrador") ? "admin_custom"
          : "general";
        playNotificationSound(tag);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [playNotificationSound]);

  return { playNotificationSound };
}
