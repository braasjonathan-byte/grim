import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function usePushNotifications(userId: string | null) {
  const subscribedRef = useRef(false);

  const subscribe = useCallback(async () => {
    if (!userId || subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Check permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      // Get VAPID public key from edge function
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke("get-vapid-key");
      if (vapidError || !vapidData?.publicKey) {
        console.error("Failed to get VAPID key:", vapidError);
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);

      // Check for existing subscription
      const mgr = (registration as any).pushManager;
      let subscription = await mgr.getSubscription();

      if (!subscription) {
        subscription = await mgr.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint!;
      const p256dh = subJson.keys?.p256dh || "";
      const auth = subJson.keys?.auth || "";

      // Store in database (upsert)
      await supabase.from("push_subscriptions" as any).upsert(
        { user_id: userId, endpoint, p256dh, auth } as any,
        { onConflict: "user_id,endpoint" }
      );

      subscribedRef.current = true;
    } catch (err) {
      console.error("Push subscription error:", err);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      subscribe();
    }
  }, [userId, subscribe]);
}

export async function notifyFriendsOfCompletion(day: string, week: number, sessionName: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Deduplicate: only notify once per user+week+day
    const uid = session.user.id;
    const storageKey = `notified_${uid}_${week}_${day}`;
    if (localStorage.getItem(storageKey)) return;

    await supabase.functions.invoke("notify-friends", {
      body: { day, week, sessionName },
    });

    localStorage.setItem(storageKey, "1");
  } catch (err) {
    console.error("Failed to notify friends:", err);
  }
}
