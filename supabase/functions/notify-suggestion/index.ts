import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Function to decode Base64 URL strings
function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const localKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );

    const localPublicKeyRaw = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);

    const subscriberPublicKey = await crypto.subtle.importKey(
      "raw",
      base64UrlDecode(subscription.p256dh),
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    const sharedSecret = await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberPublicKey },
      localKeyPair.privateKey,
      256
    );

    const authSecret = base64UrlDecode(subscription.auth);
    const payloadBytes = new TextEncoder().encode(payload);

    const prkKey = await crypto.subtle.importKey("raw", authSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const prk = await crypto.subtle.sign("HMAC", prkKey, sharedSecret);

    const keyInfoBuf = new TextEncoder().encode("Content-Encoding: aes128gcm\x00");
    const nonceInfoBuf = new TextEncoder().encode("Content-Encoding: nonce\x00");

    const prkImport = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);

    const cekBits = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecret, info: keyInfoBuf },
      prkImport,
      128
    );

    const nonceBits = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: authSecret, info: nonceInfoBuf },
      prkImport,
      96
    );

    const cek = await crypto.subtle.importKey("raw", cekBits, "AES-GCM", false, ["encrypt"]);

    const paddedPayload = new Uint8Array(payloadBytes.length + 2);
    paddedPayload.set(payloadBytes);
    paddedPayload[payloadBytes.length] = 2;
    paddedPayload[payloadBytes.length + 1] = 0;

    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonceBits, tagLength: 128 },
      cek,
      paddedPayload
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const recordSize = new Uint8Array(4);
    new DataView(recordSize.buffer).setUint32(0, paddedPayload.length + 16 + 1, false);

    const localPubKeyBytes = new Uint8Array(localPublicKeyRaw);
    const header = new Uint8Array(16 + 4 + 1 + localPubKeyBytes.length);
    header.set(salt, 0);
    header.set(recordSize, 16);
    header[20] = localPubKeyBytes.length;
    header.set(localPubKeyBytes, 21);

    const body = new Uint8Array(header.length + new Uint8Array(encrypted).length);
    body.set(header);
    body.set(new Uint8Array(encrypted), header.length);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
      },
      body,
    });

    return response.ok || response.status === 201;
  } catch (e) {
    console.error("Push send error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { nickname } = await req.json();

    // Validate nickname input
    if (!nickname || typeof nickname !== "string" || nickname.trim().length < 1 || nickname.trim().length > 50) {
      return new Response(
        JSON.stringify({ error: "Invalid input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin user IDs
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminIds = adminRoles.map((r: any) => r.user_id);

    // Get push subscriptions for admins only
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", adminIds);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get VAPID keys
    const { data: vapid } = await supabaseAdmin
      .from("vapid_keys")
      .select("*")
      .eq("id", 1)
      .single();

    if (!vapid) {
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedNickname = nickname.trim().substring(0, 50);
    const payload = JSON.stringify({
      title: "💡 Grim",
      body: `Nytt förslag från ${sanitizedNickname}`,
      icon: "/favicon.ico",
      data: { url: "/" },
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const ok = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapid.public_key,
        vapid.private_key
      );
      if (ok) {
        sent++;
      } else {
        staleEndpoints.push(sub.endpoint);
      }
    }

    if (staleEndpoints.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", staleEndpoints);
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
