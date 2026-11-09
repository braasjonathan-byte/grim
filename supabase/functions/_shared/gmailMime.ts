// Runtime-agnostic RFC 5322 / MIME builder for the Gmail API messages.send
// "raw" field (base64url). Used by forgot-password and tested with vitest.

const utf8 = (s: string) => new TextEncoder().encode(s);

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export const base64Utf8 = (s: string) => bytesToBase64(utf8(s));
export const base64Url = (s: string) => base64Utf8(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// deno-lint-ignore no-control-regex
// eslint-disable-next-line no-control-regex
const isAscii = (s: string) => /^[\x00-\x7F]*$/.test(s);

/**
 * RFC 2047 encoded-word(s) for non-ASCII header values. Long values are split
 * into several encoded-words (max 75 chars each) on UTF-8 character boundaries.
 */
export function encodeHeader(value: string): string {
  if (isAscii(value)) return value;
  const words: string[] = [];
  let chunk = "";
  for (const ch of value) {
    // 45 bytes of UTF-8 -> 60 base64 chars -> 72 chars with =?UTF-8?B??=
    if (utf8(chunk + ch).length > 45) {
      words.push(`=?UTF-8?B?${base64Utf8(chunk)}?=`);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(`=?UTF-8?B?${base64Utf8(chunk)}?=`);
  return words.join("\r\n ");
}

/** `"Display Name" <addr>` with the display name RFC 2047-encoded when non-ASCII. */
export function formatAddress(name: string, address: string): string {
  if (/[\r\n<>]/.test(name + address)) throw new Error("invalid header");
  return isAscii(name) ? `"${name.replace(/["\\]/g, "\\$&")}" <${address}>` : `${encodeHeader(name)} <${address}>`;
}

/** Quoted-printable (RFC 2045) for UTF-8 text; CRLF line endings, soft breaks at 76. */
export function quotedPrintable(input: string): string {
  const lines = input.replace(/\r\n?|\n/g, "\n").split("\n");
  return lines
    .map((line) => {
      const bytes = utf8(line);
      const tokens: string[] = [];
      bytes.forEach((b, i) => {
        const last = i === bytes.length - 1;
        const printable = (b >= 33 && b <= 126 && b !== 61) || ((b === 32 || b === 9) && !last);
        tokens.push(printable ? String.fromCharCode(b) : `=${b.toString(16).toUpperCase().padStart(2, "0")}`);
      });
      const out: string[] = [];
      let cur = "";
      for (const t of tokens) {
        if (cur.length + t.length > 75) {
          out.push(`${cur}=`);
          cur = "";
        }
        cur += t;
      }
      out.push(cur);
      return out.join("\r\n");
    })
    .join("\r\n");
}

const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n").trimEnd();

/** RFC 5322 date, e.g. "Mon, 09 Nov 2026 09:44:00 +0000". */
export function rfc5322Date(d: Date): string {
  return d.toUTCString().replace(/GMT$/, "+0000");
}

export function buildMimeMessage(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  boundary?: string;
  date?: Date;
  /** Optional; Gmail sets its own Message-ID when omitted. */
  messageId?: string;
  transferEncoding?: "quoted-printable" | "base64";
}): string {
  if (/[\r\n]/.test(opts.to + opts.from + (opts.replyTo ?? "") + (opts.messageId ?? ""))) throw new Error("invalid header");
  const boundary = opts.boundary ?? `grim_${crypto.randomUUID().replace(/-/g, "")}`;
  const cte = opts.transferEncoding ?? "quoted-printable";
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    ...(opts.replyTo ? [`Reply-To: ${opts.replyTo}`] : []),
    `Subject: ${encodeHeader(opts.subject.replace(/[\r\n]+/g, " "))}`,
    `Date: ${rfc5322Date(opts.date ?? new Date())}`,
    ...(opts.messageId ? [`Message-ID: ${opts.messageId}`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const encode = (body: string) =>
    cte === "base64" ? wrap76(base64Utf8(body.replace(/\r\n?|\n/g, "\r\n"))) : quotedPrintable(body);
  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset="UTF-8"`, `Content-Transfer-Encoding: ${cte}`, "", encode(body)].join(
      "\r\n",
    );
  return [...headers, "", part("text/plain", opts.text), part("text/html", opts.html), `--${boundary}--`, ""].join("\r\n");
}

export const toGmailRaw = (mime: string) => base64Url(mime);
