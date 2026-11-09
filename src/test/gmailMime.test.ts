import { describe, expect, it } from "vitest";
import { base64Url, buildMimeMessage, encodeHeader, toGmailRaw } from "../../supabase/functions/_shared/gmailMime";
import { buildTempPasswordMail } from "../../supabase/functions/_shared/tempPassword";

const decodeB64 = (b: string) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s+/g, "")), (c) => c.charCodeAt(0)));

describe("gmail MIME", () => {
  it("encodes non-ascii subjects as RFC 2047", () => {
    expect(encodeHeader("Hello")).toBe("Hello");
    const enc = encodeHeader("Ditt tillfälliga lösenord");
    expect(enc).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(decodeB64(enc.slice(10, -2))).toBe("Ditt tillfälliga lösenord");
  });

  it("builds multipart/alternative with text and html parts", () => {
    const mail = buildTempPasswordMail({ nickname: "kalle", tempPassword: "K7mP-x9Qa-R3tW" });
    const mime = buildMimeMessage({ from: '"Grim Support" <grimtraning@gmail.com>', to: "k@example.com", boundary: "B", ...mail });
    expect(mime).toContain('From: "Grim Support" <grimtraning@gmail.com>\r\n');
    expect(mime).toContain("To: k@example.com\r\n");
    expect(mime).toContain('Content-Type: multipart/alternative; boundary="B"');
    const parts = mime.split("--B");
    expect(parts).toHaveLength(4);
    const body = (p: string) => decodeB64(p.split("\r\n\r\n")[1]);
    expect(parts[1]).toContain("text/plain");
    expect(body(parts[1])).toContain("K7mP-x9Qa-R3tW");
    expect(body(parts[1])).toContain("24 timmar");
    expect(parts[2]).toContain("text/html");
    expect(body(parts[2])).toContain("Ditt tillfälliga lösenord");
    expect(mime.trimEnd().endsWith("--B--")).toBe(true);
  });

  it("rejects header injection", () => {
    expect(() => buildMimeMessage({ from: "a", to: "x@y.se\r\nBcc: evil@z.se", subject: "s", text: "t", html: "h" })).toThrow();
  });

  it("produces base64url without padding", () => {
    expect(base64Url("åäö??>")).not.toMatch(/[+/=]/);
    const raw = toGmailRaw("Subject: x\r\n\r\nhej");
    expect(decodeB64(raw.replace(/-/g, "+").replace(/_/g, "/"))).toBe("Subject: x\r\n\r\nhej");
  });
});
