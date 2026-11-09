import { describe, expect, it } from "vitest";
import {
  base64Url,
  buildMimeMessage,
  encodeHeader,
  formatAddress,
  quotedPrintable,
  rfc5322Date,
  toGmailRaw,
} from "../../supabase/functions/_shared/gmailMime";
import { buildTempPasswordMail, TEMP_PASSWORD_MAIL_SUBJECT } from "../../supabase/functions/_shared/tempPassword";

const decodeB64 = (b: string) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/\s+/g, "")), (c) => c.charCodeAt(0)));
const decodeQP = (s: string) => {
  const joined = s.replace(/=\r\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === "=") {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(joined.charCodeAt(i));
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
};
const decodeWords = (h: string) =>
  h
    .split(/\r\n /)
    .map((w) => decodeB64(w.replace(/^=\?UTF-8\?B\?/, "").replace(/\?=$/, "")))
    .join("");

describe("gmail MIME", () => {
  it("encodes non-ascii subjects as RFC 2047", () => {
    expect(encodeHeader("Hello")).toBe("Hello");
    const enc = encodeHeader("Ditt tillfälliga lösenord");
    expect(enc).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(decodeB64(enc.slice(10, -2))).toBe("Ditt tillfälliga lösenord");
  });

  it("splits long non-ascii headers into encoded-words of max 75 chars", () => {
    const long = "Åäö ".repeat(30).trim();
    const enc = encodeHeader(long);
    for (const w of enc.split("\r\n ")) {
      expect(w.length).toBeLessThanOrEqual(75);
      expect(w).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    }
    expect(decodeWords(enc)).toBe(long);
  });

  it("formats From display names (ascii quoted, non-ascii encoded)", () => {
    expect(formatAddress("Grim Support", "grimtraning@gmail.com")).toBe('"Grim Support" <grimtraning@gmail.com>');
    const enc = formatAddress("Grim Tränings-support", "grimtraning@gmail.com");
    expect(enc).toMatch(/^=\?UTF-8\?B\?.+\?= <grimtraning@gmail\.com>$/);
    expect(decodeWords(enc.replace(/ <.*$/, ""))).toBe("Grim Tränings-support");
    expect(() => formatAddress("x\r\nBcc: a@b.se", "a@b.se")).toThrow();
  });

  it("quoted-printable encodes UTF-8 with CRLF and soft line breaks <= 76", () => {
    const src = `Hej åäö = test \n${"x".repeat(200)}\nslut`;
    const qp = quotedPrintable(src);
    expect(qp).toContain("=C3=A5=C3=A4=C3=B6");
    expect(qp).toContain("=3D");
    expect(qp).not.toMatch(/(^|[^\r])\n/);
    for (const line of qp.split("\r\n")) expect(line.length).toBeLessThanOrEqual(76);
    expect(qp.split("\r\n")[0].endsWith("=20")).toBe(true); // trailing space encoded
    expect(decodeQP(qp)).toBe(src.replace(/\n/g, "\r\n"));
  });

  it("builds multipart/alternative with all headers and both parts (quoted-printable)", () => {
    const mail = buildTempPasswordMail({ nickname: "kalle", tempPassword: "K7mP-x9Qa-R3tW" });
    const mime = buildMimeMessage({
      from: formatAddress("Grim Support", "grimtraning@gmail.com"),
      to: "k@example.com",
      replyTo: "grimtraning@gmail.com",
      boundary: "B",
      date: new Date("2026-11-09T09:00:00Z"),
      ...mail,
    });
    const [head] = mime.split("\r\n\r\n");
    expect(head).toContain('From: "Grim Support" <grimtraning@gmail.com>\r\n');
    expect(head).toContain("To: k@example.com\r\n");
    expect(head).toContain("Reply-To: grimtraning@gmail.com\r\n");
    expect(head).toContain("Date: Mon, 09 Nov 2026 09:00:00 +0000\r\n");
    expect(head).toContain("MIME-Version: 1.0\r\n");
    expect(head).toContain('Content-Type: multipart/alternative; boundary="B"');
    expect(head).not.toContain("Message-ID");
    const subj = head.match(/^Subject: (.*(?:\r\n .*)*)/m)![1];
    expect(decodeWords(subj)).toBe(TEMP_PASSWORD_MAIL_SUBJECT);
    // eslint-disable-next-line no-control-regex
    expect(mime).toMatch(/^[\x00-\x7F]*$/);

    const parts = mime.split("--B");
    expect(parts).toHaveLength(4);
    const body = (p: string) => decodeQP(p.slice(p.indexOf("\r\n\r\n") + 4).replace(/\r\n$/, ""));
    expect(parts[1]).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(parts[1]).toContain("Content-Transfer-Encoding: quoted-printable");
    expect(body(parts[1])).toContain("K7mP-x9Qa-R3tW");
    expect(body(parts[1])).toContain("24 timmar");
    expect(parts[2]).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(parts[2]).toContain("Content-Transfer-Encoding: quoted-printable");
    expect(body(parts[2])).toContain("K7mP-x9Qa-R3tW");
    expect(body(parts[2])).toContain("Ditt gamla lösenord fungerar fortfarande");
    expect(mime.trimEnd().endsWith("--B--")).toBe(true);
  });

  it("supports base64 transfer encoding and an explicit Message-ID", () => {
    const mime = buildMimeMessage({
      from: "a@b.se",
      to: "c@d.se",
      subject: "Hej",
      text: "rad1\nrad2 åäö",
      html: "<p>åäö</p>",
      boundary: "B",
      messageId: "<abc@gmail.com>",
      transferEncoding: "base64",
    });
    expect(mime).toContain("Message-ID: <abc@gmail.com>\r\n");
    const parts = mime.split("--B");
    expect(parts[1]).toContain("Content-Transfer-Encoding: base64");
    expect(decodeB64(parts[1].split("\r\n\r\n")[1])).toBe("rad1\r\nrad2 åäö");
    expect(decodeB64(parts[2].split("\r\n\r\n")[1])).toBe("<p>åäö</p>");
  });

  it("formats RFC 5322 dates", () => {
    expect(rfc5322Date(new Date("2026-01-02T03:04:05Z"))).toBe("Fri, 02 Jan 2026 03:04:05 +0000");
  });

  it("rejects header injection", () => {
    expect(() => buildMimeMessage({ from: "a", to: "x@y.se\r\nBcc: evil@z.se", subject: "s", text: "t", html: "h" })).toThrow();
    expect(() =>
      buildMimeMessage({ from: "a", to: "x@y.se", subject: "s", text: "t", html: "h", messageId: "<a>\r\nBcc: e@z.se" }),
    ).toThrow();
  });

  it("produces base64url without padding", () => {
    expect(base64Url("åäö??>")).not.toMatch(/[+/=]/);
    const raw = toGmailRaw("Subject: x\r\n\r\nhej");
    expect(decodeB64(raw.replace(/-/g, "+").replace(/_/g, "/"))).toBe("Subject: x\r\n\r\nhej");
  });
});

describe("temp password mail content", () => {
  const m = buildTempPasswordMail({ nickname: "kalle", tempPassword: "K7mP-x9Qa-R3tW" });
  it("has a fixed subject and all required facts in both parts", () => {
    expect(m.subject).toBe("Ditt tillfälliga lösenord till Grim");
    for (const body of [m.text, m.html]) {
      expect(body).toContain("kalle");
      expect(body).toContain("K7mP-x9Qa-R3tW");
      expect(body).toContain("24 timmar");
      expect(body).toContain("gamla lösenord fungerar fortfarande");
      expect(body).toContain("välja ett nytt lösenord");
      expect(body).toContain("Om du inte har begärt detta kan du ignorera mejlet");
      expect(body).toContain("Grim · grim.lovable.app · Svara på detta mejl om du behöver hjälp");
    }
  });
  it("avoids spammy patterns and has at most one link, no external images", () => {
    for (const body of [m.text, m.html]) {
      expect(body).not.toMatch(/gratis|klicka här|!!/i);
      expect(body.replace("<!doctype html>", "")).not.toMatch(/!/);
    }
    expect(m.html).not.toMatch(/<img/i);
    expect(m.html.match(/<a\s/gi) ?? []).toHaveLength(1);
    expect(m.html).toContain('href="https://grim.lovable.app"');
    const caps = (m.text + m.html.replace(/<[^>]+>/g, " ")).match(/\b[A-ZÅÄÖ]{4,}\b/g) ?? [];
    expect(caps.filter((w) => w !== "GRIM")).toEqual([]);
  });
});
