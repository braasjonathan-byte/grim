import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Send push notifications to native devices via FCM HTTP v1 API.
 * Requires FCM_SERVER_KEY secret to be set.
 * Returns number of successfully sent notifications.
 */
export async function sendNativePush(
  supabaseAdmin: ReturnType<typeof createClient>,
  userIds: string[],
  notification: { title: string; body: string; data?: Record<string, string> }
): Promise<number> {
  const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
  if (!fcmServerKey) {
    console.log("FCM_SERVER_KEY not set, skipping native push");
    return 0;
  }

  // Fetch all device tokens for the given users
  const { data: tokens } = await supabaseAdmin
    .from("device_push_tokens")
    .select("*")
    .in("user_id", userIds);

  if (!tokens || tokens.length === 0) return 0;

  let sent = 0;
  const staleTokenIds: string[] = [];

  for (const tokenRow of tokens) {
    try {
      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${fcmServerKey}`,
        },
        body: JSON.stringify({
          to: tokenRow.token,
          notification: {
            title: notification.title,
            body: notification.body,
            icon: "/favicon.ico",
          },
          data: notification.data || {},
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success === 1) {
          sent++;
        } else {
          // Token might be invalid
          console.error("FCM send failed for token:", result.results?.[0]?.error);
          if (
            result.results?.[0]?.error === "NotRegistered" ||
            result.results?.[0]?.error === "InvalidRegistration"
          ) {
            staleTokenIds.push(tokenRow.id);
          }
        }
      } else {
        console.error("FCM HTTP error:", response.status, await response.text());
      }
    } catch (e) {
      console.error("FCM send error:", e);
    }
  }

  // Clean up stale tokens
  if (staleTokenIds.length > 0) {
    await supabaseAdmin.from("device_push_tokens").delete().in("id", staleTokenIds);
  }

  return sent;
}
