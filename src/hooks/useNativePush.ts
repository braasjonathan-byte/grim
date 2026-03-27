import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";

/**
 * Registers native push notifications (FCM/APNs) when running inside
 * a Capacitor native shell. Stores the device token in device_push_tokens.
 * This hook is a no-op on the web (PWA uses Web Push instead).
 */
export function useNativePush(userId: string | null) {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!userId || registeredRef.current) return;
    if (!Capacitor.isNativePlatform()) return;

    const setup = async () => {
      try {
        // Request permission
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== "granted") {
          console.log("Native push permission denied");
          return;
        }

        // Listen for registration success
        PushNotifications.addListener("registration", async (token) => {
          console.log("Native push token:", token.value);
          const platform = Capacitor.getPlatform(); // 'android' | 'ios'

          // Upsert token
          await supabase
            .from("device_push_tokens")
            .delete()
            .eq("user_id", userId)
            .eq("token", token.value);

          await supabase.from("device_push_tokens").insert({
            user_id: userId,
            token: token.value,
            platform,
          });

          registeredRef.current = true;
        });

        // Listen for registration errors
        PushNotifications.addListener("registrationError", (err) => {
          console.error("Native push registration error:", err);
        });

        // Handle notification received while app is open
        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("Push received in foreground:", notification);
        });

        // Handle notification tap
        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const url = action.notification.data?.url;
          if (url) {
            window.location.href = url;
          }
        });

        // Register with FCM/APNs
        await PushNotifications.register();
      } catch (err) {
        console.error("Native push setup error:", err);
      }
    };

    setup();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [userId]);
}
