import { describe, expect, it } from "vitest";
import {
  buildTempPasswordMail,
  expiresAtFrom,
  findMatchingTempRow,
  generateTempPassword,
  getClientIp,
  isRateLimited,
  isRowUsable,
  looksLikeTempPassword,
  normalizeIdentifier,
  RATE_LIMITS,
  TEMP_PASSWORD_ALPHABET,
  TEMP_PASSWORD_TTL_MS,
  type TempPasswordRow,
} from "../../supabase/functions/_shared/tempPassword";

// Stand-in for bcrypt: deterministic but distinct from the plain text
const fakeHash = (p: string) => `hash:${[...p].reverse().join("")}`;
const fakeCompare = async (p: string, h: string) => h === fakeHash(p);

const NOW = new Date("2026-11-09T08:00:00Z");
const row = (over: Partial<TempPasswordRow> & { pw: string }): TempPasswordRow => ({
  id: over.id ?? "r1",
  user_id: "u1",
  password_hash: fakeHash(over.pw),
  expires_at: over.expires_at ?? new Date(NOW.getTime() + 3600_000).toISOString(),
  used_at: over.used_at ?? null,
});

describe("generateTempPassword", () => {
  it("produces 3 groups of 4 readable chars", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(pw).toMatch(/^.{4}-.{4}-.{4}$/);
      for (const c of pw.replace(/-/g, "")) expect(TEMP_PASSWORD_ALPHABET).toContain(c);
      expect(pw).not.toMatch(/[0O1lI]/);
      expect(looksLikeTempPassword(pw)).toBe(true);
    }
  });

  it("is random (no duplicates in 500 draws)", () => {
    const set = new Set(Array.from({ length: 500 }, () => generateTempPassword()));
    expect(set.size).toBe(500);
  });

  it("uses rejection sampling (bytes >= limit are skipped)", () => {
    let call = 0;
    const pw = generateTempPassword((buf) => {
      call++;
      // first byte 255 is out of range for 55 chars (limit 220) and must be skipped
      buf.fill(0);
      buf[0] = 255;
      return buf;
    });
    expect(call).toBe(1);
    expect(pw).toBe("AAAA-AAAA-AAAA");
  });
});

describe("looksLikeTempPassword", () => {
  it("rejects normal passwords", () => {
    expect(looksLikeTempPassword("hunter2hunter2")).toBe(false);
    expect(looksLikeTempPassword("ABCD-EFGH")).toBe(false);
    expect(looksLikeTempPassword("ABC0-EFGH-JKMN")).toBe(false);
    expect(looksLikeTempPassword(" ABCD-EFGH-JKMN ")).toBe(true);
  });
});

describe("expiry / usability", () => {
  it("expires 24h after creation", () => {
    expect(Date.parse(expiresAtFrom(NOW)) - NOW.getTime()).toBe(TEMP_PASSWORD_TTL_MS);
  });
  it("rejects used and expired rows", () => {
    expect(isRowUsable(row({ pw: "x" }), NOW)).toBe(true);
    expect(isRowUsable(row({ pw: "x", used_at: NOW.toISOString() }), NOW)).toBe(false);
    expect(isRowUsable(row({ pw: "x", expires_at: NOW.toISOString() }), NOW)).toBe(false);
    expect(isRowUsable(row({ pw: "x", expires_at: "garbage" }), NOW)).toBe(false);
  });
});

describe("findMatchingTempRow", () => {
  const good = "K7mP-x9Qa-R3tW";
  it("matches an unexpired unused hash", async () => {
    const rows = [row({ id: "a", pw: "AAAA-BBBB-CCCC" }), row({ id: "b", pw: good })];
    expect((await findMatchingTempRow(rows, good, fakeCompare, NOW))?.id).toBe("b");
  });
  it("trims input", async () => {
    expect(await findMatchingTempRow([row({ pw: good })], `  ${good} `, fakeCompare, NOW)).not.toBeNull();
  });
  it("does not match wrong, used or expired", async () => {
    expect(await findMatchingTempRow([row({ pw: good })], "K7mP-x9Qa-R3tX", fakeCompare, NOW)).toBeNull();
    expect(await findMatchingTempRow([row({ pw: good, used_at: NOW.toISOString() })], good, fakeCompare, NOW)).toBeNull();
    expect(
      await findMatchingTempRow([row({ pw: good, expires_at: new Date(NOW.getTime() - 1).toISOString() })], good, fakeCompare, NOW),
    ).toBeNull();
  });
  it("never calls compare for non-temp-shaped passwords", async () => {
    let calls = 0;
    const res = await findMatchingTempRow([row({ pw: good })], "mittvanligalosen", async () => { calls++; return true; }, NOW);
    expect(res).toBeNull();
    expect(calls).toBe(0);
  });
  it("survives a throwing compare (malformed hash)", async () => {
    const res = await findMatchingTempRow([row({ pw: good })], good, async () => { throw new Error("bad"); }, NOW);
    expect(res).toBeNull();
  });
});

describe("helpers", () => {
  it("rate limit thresholds", () => {
    expect(isRateLimited(2, RATE_LIMITS.forgotPerIdentifier)).toBe(false);
    expect(isRateLimited(3, RATE_LIMITS.forgotPerIdentifier)).toBe(true);
  });
  it("normalizes identifiers", () => {
    expect(normalizeIdentifier("  Kalle ")).toEqual({ kind: "nickname", value: "kalle" });
    expect(normalizeIdentifier("Kalle@Example.com")).toEqual({ kind: "email", value: "kalle@example.com" });
    expect(normalizeIdentifier("a")).toBeNull();
    expect(normalizeIdentifier("bad@")).toBeNull();
    expect(normalizeIdentifier(42)).toBeNull();
  });
  it("reads client ip", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(h)).toBe("1.2.3.4");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
  it("builds a Swedish mail with the password and escapes html", () => {
    const m = buildTempPasswordMail({ nickname: "<b>kalle</b>", tempPassword: "K7mP-x9Qa-R3tW" });
    expect(m.subject).toContain("tillfälliga lösenord");
    expect(m.text).toContain("K7mP-x9Qa-R3tW");
    expect(m.text).toContain("24 timmar");
    expect(m.text).toContain("gamla lösenord fungerar fortfarande");
    expect(m.html).toContain("K7mP-x9Qa-R3tW");
    expect(m.html).not.toContain("<b>kalle</b>");
    expect(m.html).toContain("&lt;b&gt;kalle&lt;/b&gt;");
  });
});
