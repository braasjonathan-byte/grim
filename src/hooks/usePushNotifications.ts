import { useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const DAYS = ["Mån", "Tis", "Ons", "Tors", "Fre", "Lör", "Sön"];

const getBaseDay = (day: string) => day.replace(/_[a-z0-9]+$/i, "");

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonday(date: Date): Date {
  const monday = new Date(date);
  const day = monday.getDay() || 7;
  monday.setDate(monday.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isWorkoutScheduledToday(day: string, week: number, planStartDate?: string | null): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateMatch = day.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) return dateMatch[1] === localDateKey(today);

  if (planStartDate && week > 0) {
    const [year, month, date] = planStartDate.split("-").map(Number);
    const dayIndex = DAYS.indexOf(getBaseDay(day.trim()));
    if (year && month && date && dayIndex >= 0) {
      const startMonday = getMonday(new Date(year, month - 1, date));
      const workoutDate = new Date(startMonday);
      workoutDate.setDate(workoutDate.getDate() + (week - 1) * 7 + dayIndex);
      workoutDate.setHours(0, 0, 0, 0);
      return workoutDate.getTime() === today.getTime();
    }
  }

  const todayDay = DAYS[(today.getDay() + 6) % 7];
  return getBaseDay(day.trim()) === todayDay;
}

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

export function usePushNotifications(userId: string | null) {
  const subscribedRef = useRef(false);

  const subscribe = useCallback(async () => {
    if (!userId || subscribedRef.current) return;
    if (Capacitor.isNativePlatform()) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    try {
      // Use the PWA service worker (already registered by VitePWA)
      const registration = await navigator.serviceWorker.ready;

      // Only proceed if permission is already granted (don't prompt here)
      if (Notification.permission !== "granted") return;

      // Get VAPID public key from edge function
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke("get-vapid-key");
      if (vapidError || !vapidData?.publicKey) {
        console.error("Failed to get VAPID key:", vapidError);
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);

      const mgr = (registration as any).pushManager;
      let subscription = await mgr.getSubscription();

      // On iOS, subscriptions can become stale after app restart.
      // Re-subscribe if the existing subscription's key doesn't match our VAPID key.
      if (subscription) {
        try {
          const existingKey = subscription.options?.applicationServerKey;
          if (existingKey) {
            const existingKeyArr = new Uint8Array(existingKey);
            const keysMatch = existingKeyArr.length === applicationServerKey.length &&
              existingKeyArr.every((b: number, i: number) => b === applicationServerKey[i]);
            if (!keysMatch) {
              await subscription.unsubscribe();
              subscription = null;
            }
          }
        } catch {
          // If we can't check, just keep the existing subscription
        }
      }

      if (!subscription) {
        try {
          subscription = await mgr.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
        } catch (subErr) {
          console.error("PushManager.subscribe failed:", subErr);
          return;
        }
      }

      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint!;
      const p256dh = subJson.keys?.p256dh || "";
      const auth = subJson.keys?.auth || "";

      if (!p256dh || !auth) {
        console.error("Push subscription missing keys");
        return;
      }

      const displayMode = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches
        ? "standalone"
        : "browser";
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;

      // Store in database (upsert) - delete old entries for this user+endpoint first, then insert
      await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
      await supabase.from("push_subscriptions").insert({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        display_mode: displayMode,
      });

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

export async function notifyFriendsOfCompletion(day: string, week: number, sessionName: string, planStartDate?: string | null) {
  try {
    // Only notify friends for workouts scheduled for today, not retroactive logging.
    if (!isWorkoutScheduledToday(day, week, planStartDate)) return;

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
