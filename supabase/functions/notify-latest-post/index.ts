// One-shot trigger: push the latest public social post to all users.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNativePush } from "../_shared/sendFcm.ts";
import { authorizeCronCall } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function b64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...a: Uint8Array[]): Uint8Array {
  const t = a.reduce((s, x) => s + x.length, 0);
  const r = new Uint8Array(t);
  let o = 0;
  for (const x of a) { r.set(x, o); o += x.length; }
  return r as Uint8Array<ArrayBuffer>;
}
async function vapidJwt(endpoint: string, pub: string, priv: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const h = b64UrlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const p = b64UrlEncode(new TextEncoder().encode(JSON.stringify({ aud, exp: Math.floor(Date.now()/1000) + 43200, sub: "mailto:push@gymberget.se" })));
  const unsigned = `${h}.${p}`;
  const privBytes = b64UrlDecode(priv);
  const pubBytes = b64UrlDecode(pub);
  const jwk = { kty: "EC", crv: "P-256", d: b64UrlEncode(privBytes), x: b64UrlEncode(pubBytes.slice(1, 33)), y: b64UrlEncode(pubBytes.slice(33, 65)) };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned));
  const sb = new Uint8Array(sig);
  let rLen = sb[3], rStart = 4, sLen = sb[5+rLen], sStart = 6+rLen;
  let r: Uint8Array = sb.slice(rStart, rStart+rLen);
  let s: Uint8Array = sb.slice(sStart, sStart+sLen);
  if (r.length === 33 && r[0] === 0) r = r.slice(1);
  if (s.length === 33 && s[0] === 0) s = s.slice(1);
  while (r.length < 32) r = concat(new Uint8Array([0]), r);
  while (s.length < 32) s = concat(new Uint8Array([0]), s);
  return `vapid t=${unsigned}.${b64UrlEncode(concat(r, s))}, k=${pub}`;
}
async function encrypt(plaintext: string, p256dh: Uint8Array, auth: Uint8Array): Promise<Uint8Array> {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const subKey = await crypto.subtle.importKey("raw", p256dh as unknown as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: subKey }, kp.privateKey, 256));
  const enc = new TextEncoder();
  const ikmInfo = concat(enc.encode("WebPush: info\0"), p256dh, localPub);
  const authKey = await crypto.subtle.importKey("raw", auth as unknown as BufferSource, { name: "HKDF" }, false, ["deriveBits"]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: shared as unknown as BufferSource, info: ikmInfo as unknown as BufferSource }, authKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await crypto.subtle.importKey("raw", ikm as unknown as BufferSource, { name: "HKDF" }, false, ["deriveBits"]);
  const cekBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as unknown as BufferSource, info: enc.encode("Content-Encoding: aes128gcm\0") }, prk, 128);
  const nonce = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as unknown as BufferSource, info: enc.encode("Content-Encoding: nonce\0") }, prk, 96);
  const cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, ["encrypt"]);
  const padded = concat(enc.encode(plaintext), new Uint8Array([2]));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as unknown as BufferSource }, cek, padded as unknown as BufferSource));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096, false);
  return concat(salt, rs, new Uint8Array([localPub.length]), localPub, ct);
}
async function sendWeb(sub: { endpoint: string; p256dh: string; auth: string }, payload: string, pub: string, priv: string): Promise<boolean> {
  try {
    const authz = await vapidJwt(sub.endpoint, pub, priv);
    const body = await encrypt(payload, b64UrlDecode(sub.p256dh), b64UrlDecode(sub.auth));
    const r = await fetch(sub.endpoint, { method: "POST", headers: { "Content-Type": "application/octet-stream", "Content-Encoding": "aes128gcm", "Authorization": authz, "TTL": "86400" }, body });
    return r.ok || r.status === 201;
  } catch { return false; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await authorizeCronCall(req, corsHeaders);
  if (denied) return denied;
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: post } = await admin.from("social_posts").select("id, user_id, caption, visibility").eq("visibility", "public").order("created_at", { ascending: false }).limit(1).single();
    if (!post) return new Response(JSON.stringify({ error: "No public post" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile } = await admin.from("profiles").select("nickname").eq("user_id", post.user_id).single();
    const nickname = profile?.nickname || "Någon";
    const { data: roleData } = await admin.from("user_roles").select("role").eq("user_id", post.user_id).maybeSingle();
    const isAdmin = roleData?.role === "admin";

    const { data: allProfiles } = await admin.from("profiles").select("user_id");
    const targetUserIds = (allProfiles || []).map(p => p.user_id).filter(id => id !== post.user_id);
    if (targetUserIds.length === 0) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: subs } = await admin.from("push_subscriptions").select("*").in("user_id", targetUserIds);
    const { data: vapid } = await admin.from("vapid_keys").select("*").eq("id", 1).single();

    const cap = post.caption ? (post.caption.length > 60 ? post.caption.slice(0, 57) + "..." : post.caption) : "Nytt inlägg";
    const payload = JSON.stringify({
      title: isAdmin ? "📢 Grim" : `📸 ${nickname}`,
      body: isAdmin ? `Admin: ${cap}` : `${nickname} delade ett inlägg: ${cap}`,
      icon: "/favicon.ico",
      data: { url: "/?tab=social" },
    });

    let sent = 0;
    if (subs && vapid) {
      for (const s of subs) {
        if (await sendWeb({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, vapid.public_key, vapid.private_key)) sent++;
      }
    }

    const np = JSON.parse(payload);
    const nativeSent = await sendNativePush(admin, targetUserIds, { title: np.title, body: np.body, data: { url: "/?tab=social" } });

    return new Response(JSON.stringify({ sent: sent + nativeSent, postId: post.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
