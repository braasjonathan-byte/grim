import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNativePush } from "../_shared/sendFcm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

async function createVapidJwt(endpoint: string, vapidPublicKey: string, vapidPrivateKey: string): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12, sub: "mailto:push@gymberget.se" };

  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encHeader}.${encPayload}`;

  const privateKeyBytes = base64UrlDecode(vapidPrivateKey);
  const pubKeyBytes = base64UrlDecode(vapidPublicKey);
  const jwk = { kty: "EC", crv: "P-256", d: base64UrlEncode(privateKeyBytes), x: base64UrlEncode(pubKeyBytes.slice(1, 33)), y: base64UrlEncode(pubKeyBytes.slice(33, 65)) };

  const signingKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, new TextEncoder().encode(unsignedToken));

  const sigBytes = new Uint8Array(signatureBuffer);
  let rLen = sigBytes[3];
  let rStart = 4;
  let sLen = sigBytes[5 + rLen];
  let sStart = 6 + rLen;

  let r = sigBytes.slice(rStart, rStart + rLen);
  let s = sigBytes.slice(sStart, sStart + sLen);
  if (r.length === 33 && r[0] === 0) r = r.slice(1);
  if (s.length === 33 && s[0] === 0) s = s.slice(1);
  while (r.length < 32) r = concatUint8Arrays(new Uint8Array([0]), r);
  while (s.length < 32) s = concatUint8Arrays(new Uint8Array([0]), s);

  const fixedSig = base64UrlEncode(concatUint8Arrays(r, s));
  return `vapid t=${unsignedToken}.${fixedSig}, k=${vapidPublicKey}`;
}

async function encryptPayload(
  plaintext: string, p256dhKey: Uint8Array, authSecret: Uint8Array
): Promise<Uint8Array> {
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  const subscriberKey = await crypto.subtle.importKey("raw", p256dhKey, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: subscriberKey }, localKeyPair.privateKey, 256));

  const enc = new TextEncoder();
  const ikmInput = concatUint8Arrays(enc.encode("WebPush: info\0"), p256dhKey, localPubRaw);
  const authKey = await crypto.subtle.importKey("raw", authSecret, { name: "HKDF" }, false, ["deriveBits"]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sharedSecret, info: ikmInput }, authKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prkKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, ["deriveBits"]);
  const cekBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: aes128gcm\0") }, prkKey, 128);
  const nonceBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode("Content-Encoding: nonce\0") }, prkKey, 96);

  const cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);
  const padded = concatUint8Arrays(enc.encode(plaintext), new Uint8Array([2]));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceBits }, cek, padded));

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const header = concatUint8Arrays(salt, rs, new Uint8Array([localPubRaw.length]), localPubRaw);
  return concatUint8Arrays(header, encrypted);
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string, vapidPublicKey: string, vapidPrivateKey: string
): Promise<boolean> {
  try {
    const authorization = await createVapidJwt(subscription.endpoint, vapidPublicKey, vapidPrivateKey);
    const body = await encryptPayload(payload, base64UrlDecode(subscription.p256dh), base64UrlDecode(subscription.auth));

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Content-Encoding": "aes128gcm", "Authorization": authorization, "TTL": "86400" },
      body,
    });

    if (!response.ok && response.status !== 201) {
      console.error(`Push failed: ${response.status} ${await response.text()}`);
      return false;
    }
    return true;
  } catch (e) { console.error("Push send error:", e); return false; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { caption, visibility } = await req.json();

    // Get poster's nickname
    const { data: profile } = await supabaseAdmin.from("profiles").select("nickname").eq("user_id", user.id).single();
    const nickname = profile?.nickname || "Någon";

    // Check if poster is admin
    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const isAdmin = roleData?.role === "admin";

    // Determine target audience based on visibility
    let targetUserIds: string[] = [];

    if (visibility === "friends") {
      // Friends-only post: notify friends
      const { data: friendships } = await supabaseAdmin.from("friendships").select("user_id, friend_id").eq("status", "accepted").or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
      if (friendships) {
        targetUserIds = friendships.map(f => f.user_id === user.id ? f.friend_id : f.user_id);
      }
    } else if (visibility === "public" && isAdmin) {
      // Only admin public posts notify all users
      const { data: allProfiles } = await supabaseAdmin.from("profiles").select("user_id");
      if (allProfiles) {
        targetUserIds = allProfiles.map(p => p.user_id).filter(id => id !== user.id);
      }
    }
    // Regular user public posts and group posts: no push

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: subscriptions } = await supabaseAdmin.from("push_subscriptions").select("*").in("user_id", targetUserIds);
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: vapid } = await supabaseAdmin.from("vapid_keys").select("*").eq("id", 1).single();
    if (!vapid) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const truncatedCaption = caption ? (caption.length > 60 ? caption.slice(0, 57) + "..." : caption) : "Nytt inlägg";
    const payload = JSON.stringify({
      title: isAdmin ? "📢 Grim" : `📸 ${nickname}`,
      body: isAdmin ? `Admin: ${truncatedCaption}` : `${nickname} delade ett inlägg: ${truncatedCaption}`,
      icon: "/favicon.ico",
      data: { url: "/?tab=social" },
    });

    let sent = 0;
    const staleEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const ok = await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload, vapid.public_key, vapid.private_key);
      if (ok) { sent++; } else { staleEndpoints.push(sub.endpoint); }
    }

    if (staleEndpoints.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    return new Response(JSON.stringify({ sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
