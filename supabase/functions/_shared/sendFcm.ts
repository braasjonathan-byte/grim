import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Send push notifications to native devices via FCM HTTP v1 API.
 * Requires FCM_SERVICE_ACCOUNT secret (full JSON service account key).
 * Returns number of successfully sent notifications.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface DevicePushToken {
  id: string;
  token: string;
  platform: string | null;
}

function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: unknown) => {
    const json = new TextEncoder().encode(JSON.stringify(obj));
    return btoa(String.fromCharCode(...json))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  // Import RSA private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    asBufferSource(keyBytes),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${sig}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

// Cache access token for reuse within a single invocation
let cachedToken: { token: string; expires: number } | null = null;

async function getCachedAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }
  const token = await getAccessToken(sa);
  cachedToken = { token, expires: Date.now() + 50 * 60 * 1000 }; // 50 min
  return token;
}

export async function sendNativePush(
  supabaseAdmin: any,
  userIds: string[],
  notification: { title: string; body: string; data?: Record<string, string> }
): Promise<number> {
  const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!serviceAccountJson) {
    console.log("FCM_SERVICE_ACCOUNT not set, skipping native push");
    return 0;
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(serviceAccountJson);
  } catch {
    console.error("Failed to parse FCM_SERVICE_ACCOUNT JSON");
    return 0;
  }

  // Fetch all device tokens for the given users
  const { data: tokens } = await supabaseAdmin
    .from("device_push_tokens")
    .select("*")
    .in("user_id", userIds);

  if (!tokens || tokens.length === 0) return 0;
  const deviceTokens = tokens as DevicePushToken[];

  const accessToken = await getCachedAccessToken(sa);
  const fcmUrl = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  let sent = 0;
  const staleTokenIds: string[] = [];

  for (const tokenRow of deviceTokens) {
    try {
      const message: Record<string, unknown> = {
        token: tokenRow.token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
      };

      if (notification.data && Object.keys(notification.data).length > 0) {
        message.data = notification.data;
      }

      // Platform-specific config
      if (tokenRow.platform === "android") {
        message.android = {
          priority: "high",
          notification: { icon: "ic_notification", default_sound: true },
        };
      } else if (tokenRow.platform === "ios") {
        message.apns = {
          payload: { aps: { sound: "default", badge: 1 } },
        };
      }

      const response = await fetch(fcmUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ message }),
      });

      const responseText = await response.text();

      if (response.ok) {
        sent++;
      } else {
        console.error("FCM v1 error:", response.status, responseText);
        // Check for unregistered token
        if (
          responseText.includes("UNREGISTERED") ||
          responseText.includes("INVALID_ARGUMENT")
        ) {
          staleTokenIds.push(tokenRow.id);
        }
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
