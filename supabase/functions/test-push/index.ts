import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  let r: Uint8Array, s: Uint8Array;
  if (sigBytes.length === 64) { r = sigBytes.slice(0, 32); s = sigBytes.slice(32, 64); }
  else {
    let offset = 2; const rLen = sigBytes[offset + 1]; offset += 2;
    const rRaw = sigBytes.slice(offset, offset + rLen); r = rRaw.length > 32 ? rRaw.slice(rRaw.length - 32) : rRaw;
    offset += rLen; const sLen = sigBytes[offset + 1]; offset += 2;
    const sRaw = sigBytes.slice(offset, offset + sLen); s = sRaw.length > 32 ? sRaw.slice(sRaw.length - 32) : sRaw;
  }
  const rawSig = new Uint8Array(64);
  if (r.length < 32) { rawSig.set(r, 32 - r.length); } else { rawSig.set(r, 0); }
  if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); rawSig.set(p, 32); } else { rawSig.set(s, 32); }

  return `vapid t=${unsignedToken}.${base64UrlEncode(rawSig)}, k=${vapidPublicKey}`;
}

async function encryptPayload(payload: string, subscriptionPublicKey: Uint8Array, authSecret: Uint8Array): Promise<Uint8Array> {
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  const subscriberKey = await crypto.subtle.importKey("raw", subscriptionPublicKey as unknown as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: subscriberKey }, localKeyPair.privateKey, 256));

  const keyInfo = concatUint8Arrays(new TextEncoder().encode("WebPush: info\x00"), subscriptionPublicKey, localPublicKeyRaw);
  const ecdhHkdfKey = await crypto.subtle.importKey("raw", ecdhSecret as unknown as BufferSource, "HKDF", false, ["deriveBits"]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: authSecret as unknown as BufferSource, info: keyInfo as unknown as BufferSource }, ecdhHkdfKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikmHkdfKey = await crypto.subtle.importKey("raw", ikm as unknown as BufferSource, "HKDF", false, ["deriveBits"]);

  const cekBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as unknown as BufferSource, info: new TextEncoder().encode("Content-Encoding: aes128gcm\x00") }, ikmHkdfKey, 128);
  const nonceBits = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as unknown as BufferSource, info: new TextEncoder().encode("Content-Encoding: nonce\x00") }, ikmHkdfKey, 96));

  const payloadBytes = new TextEncoder().encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2;

  const cek = await crypto.subtle.importKey("raw", cekBits, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceBits as unknown as BufferSource, tagLength: 128 }, cek, paddedPayload as unknown as BufferSource));

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, payloadBytes.length + 1 + 16 + 1, false);

  const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length);
  header.set(salt, 0); header.set(recordSize, 16); header[20] = localPublicKeyRaw.length; header.set(localPublicKeyRaw, 21);

  return concatUint8Arrays(header, encrypted);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Require admin authentication
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get all subscriptions
    const { data: subscriptions, error: subError } = await supabaseAdmin.from("push_subscriptions").select("*");
    console.log(`Found ${subscriptions?.length || 0} subscriptions, error: ${subError?.message || 'none'}`);

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, error: "No subscriptions" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: vapid, error: vapidError } = await supabaseAdmin.from("vapid_keys").select("*").eq("id", 1).single();
    console.log(`VAPID loaded: ${!!vapid}, error: ${vapidError?.message || 'none'}`);
    if (!vapid) {
      return new Response(JSON.stringify({ error: "No VAPID keys" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = JSON.stringify({
      title: "🔔 Testnotis",
      body: "Om du ser detta fungerar push-notiser!",
      icon: "/favicon.ico",
      data: { url: "/" },
    });

    const results: any[] = [];

    for (const sub of subscriptions) {
      try {
        console.log(`Sending to endpoint: ${sub.endpoint.substring(0, 60)}...`);
        const authorization = await createVapidJwt(sub.endpoint, vapid.public_key, vapid.private_key);
        const body = await encryptPayload(payload, base64UrlDecode(sub.p256dh), base64UrlDecode(sub.auth));

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            "Authorization": authorization,
            "TTL": "86400",
          },
          body,
        });

        const responseText = await response.text();
        console.log(`Response: ${response.status} ${responseText}`);
        results.push({
          user_id: sub.user_id,
          endpoint: sub.endpoint.substring(0, 60),
          status: response.status,
          response: responseText,
          ok: response.ok || response.status === 201,
        });
      } catch (e) {
        console.error(`Error sending to ${sub.endpoint.substring(0, 60)}:`, e);
        results.push({
          user_id: sub.user_id,
          endpoint: sub.endpoint.substring(0, 60),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
