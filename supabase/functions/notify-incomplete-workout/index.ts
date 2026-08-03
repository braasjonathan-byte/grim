import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendNativePush } from "../_shared/sendFcm.ts";
import { authorizeCronCall } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Web push helpers (same crypto as notify-reminder) ---
function b64uDec(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
function b64uEnc(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function cat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}
async function vapidJwt(endpoint: string, pub: string, priv: string): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: "mailto:push@gymberget.se" };
  const encH = b64uEnc(new TextEncoder().encode(JSON.stringify(header)));
  const encP = b64uEnc(new TextEncoder().encode(JSON.stringify(payload)));
  const unsigned = `${encH}.${encP}`;
  const privB = b64uDec(priv); const pubB = b64uDec(pub);
  const jwk = { kty: "EC", crv: "P-256", d: b64uEnc(privB), x: b64uEnc(pubB.slice(1, 33)), y: b64uEnc(pubB.slice(33, 65)) };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned)));
  let r: Uint8Array, s: Uint8Array;
  if (sig.length === 64) { r = sig.slice(0, 32); s = sig.slice(32, 64); }
  else {
    let off = 2; const rLen = sig[off + 1]; off += 2;
    const rRaw = sig.slice(off, off + rLen); r = rRaw.length > 32 ? rRaw.slice(rRaw.length - 32) : rRaw;
    off += rLen; const sLen = sig[off + 1]; off += 2;
    const sRaw = sig.slice(off, off + sLen); s = sRaw.length > 32 ? sRaw.slice(sRaw.length - 32) : sRaw;
  }
  const raw = new Uint8Array(64);
  if (r.length < 32) raw.set(r, 32 - r.length); else raw.set(r, 0);
  if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); raw.set(p, 32); } else raw.set(s, 32);
  return `vapid t=${unsigned}.${b64uEnc(raw)}, k=${pub}`;
}
async function encrypt(payload: string, subPub: Uint8Array, auth: Uint8Array): Promise<Uint8Array> {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const subKey = await crypto.subtle.importKey("raw", subPub as unknown as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: subKey }, kp.privateKey, 256));
  const keyInfo = cat(new TextEncoder().encode("WebPush: info\x00"), subPub, localPub);
  const hkdf1 = await crypto.subtle.importKey("raw", secret as unknown as BufferSource, "HKDF", false, ["deriveBits"]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: auth as unknown as BufferSource, info: keyInfo as unknown as BufferSource }, hkdf1, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hkdf2 = await crypto.subtle.importKey("raw", ikm as unknown as BufferSource, "HKDF", false, ["deriveBits"]);
  const cek = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as unknown as BufferSource, info: new TextEncoder().encode("Content-Encoding: aes128gcm\x00") }, hkdf2, 128);
  const nonce = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: salt as unknown as BufferSource, info: new TextEncoder().encode("Content-Encoding: nonce\x00") }, hkdf2, 96));
  const pb = new TextEncoder().encode(payload);
  const padded = new Uint8Array(pb.length + 1); padded.set(pb); padded[pb.length] = 2;
  const cekKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const enc = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as unknown as BufferSource, tagLength: 128 }, cekKey, padded as unknown as BufferSource));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, pb.length + 1 + 16 + 1, false);
  const hdr = new Uint8Array(16 + 4 + 1 + localPub.length);
  hdr.set(salt, 0); hdr.set(rs, 16); hdr[20] = localPub.length; hdr.set(localPub, 21);
  return cat(hdr, enc);
}
async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string, pub: string, priv: string): Promise<boolean> {
  try {
    const authz = await vapidJwt(sub.endpoint, pub, priv);
    const body = await encrypt(payload, b64uDec(sub.p256dh), b64uDec(sub.auth));
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Content-Encoding": "aes128gcm", "Authorization": authz, "TTL": "86400" },
      body,
    });
    return res.ok || res.status === 201;
  } catch (e) { console.error("web push:", e); return false; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await authorizeCronCall(req, corsHeaders);
  if (denied) return denied;

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = Date.now();
    const upperIso = new Date(now - 2 * 3600 * 1000).toISOString();      // <= now - 2h
    const lowerIso = new Date(now - 2 * 3600 * 1000 - 30 * 60 * 1000).toISOString(); // >= now - 2h30m

    // Find "logged but not marked done" rows updated ~2h ago
    const { data: rows, error } = await admin
      .from("workout_completions")
      .select("id, user_id, week, day, done, logged_distance_km, logged_tempo, logged_pulse, logged_weights, updated_at")
      .eq("done", false)
      .gte("updated_at", lowerIso)
      .lte("updated_at", upperIso);
    if (error) throw error;

    const candidates = (rows || []).filter((r: any) => {
      const hasData =
        r.logged_distance_km != null ||
        (r.logged_tempo && String(r.logged_tempo).trim() !== "") ||
        r.logged_pulse != null ||
        (r.logged_weights && JSON.stringify(r.logged_weights) !== "{}");
      return hasData;
    });
    if (candidates.length === 0) {
      return new Response(JSON.stringify({ sent: 0, checked: rows?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: vapid } = await admin.from("vapid_keys").select("*").eq("id", 1).single();
    let sent = 0;

    for (const c of candidates) {
      // Skip if we already sent this reminder
      const { data: existing } = await admin
        .from("notification_log")
        .select("id")
        .eq("user_id", c.user_id)
        .eq("week", c.week)
        .eq("day", c.day)
        .eq("type", "incomplete_reminder")
        .maybeSingle();
      if (existing) continue;

      // Verify the day still has a real workout plan
      const { data: plans } = await admin
        .from("workout_plans")
        .select("session_name, details")
        .eq("user_id", c.user_id)
        .eq("week", c.week)
        .eq("day", c.day);
      const hasWorkout = (plans || []).some((p: any) => (p.details || "").trim() !== "");
      if (!hasWorkout) continue;

      const sessionName = (plans || []).map((p: any) => p.session_name).filter(Boolean).join(" + ") || "passet";
      const payload = JSON.stringify({
        title: "⏰ Klarmarkera passet",
        body: `Du loggade "${sessionName}" men markerade det aldrig som klart. Klart nu?`,
        icon: "/favicon.ico",
        data: { url: "/?tab=workout" },
      });

      // Web push
      if (vapid) {
        const { data: subs } = await admin.from("push_subscriptions").select("*").eq("user_id", c.user_id);
        for (const s of subs || []) {
          const ok = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, vapid.public_key, vapid.private_key);
          if (ok) sent++;
        }
      }

      // Native push
      const n = JSON.parse(payload);
      sent += await sendNativePush(admin, [c.user_id], { title: n.title, body: n.body, data: { url: String(n.data.url) } });

      // Log so we don't send again
      await admin.from("notification_log").insert({
        user_id: c.user_id, week: c.week, day: c.day, type: "incomplete_reminder",
      });
    }

    return new Response(JSON.stringify({ sent, candidates: candidates.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("notify-incomplete-workout error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
