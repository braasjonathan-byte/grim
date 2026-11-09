// Runtime-agnostic RFC 2822 / MIME builder for the Gmail API messages.send
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

/** RFC 2047 encoded-word for non-ASCII header values. */
export function encodeHeader(value: string): string {
  // deno-lint-ignore no-control-regex
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${base64Utf8(value)}?=`;
}

const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n").trimEnd();

export function buildMimeMessage(opts: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  boundary?: string;
}): string {
  if (/[\r\n]/.test(opts.to + opts.from + (opts.replyTo ?? ""))) throw new Error("invalid header");
  const boundary = opts.boundary ?? `grim_${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    ...(opts.replyTo ? [`Reply-To: ${opts.replyTo}`] : []),
    `Subject: ${encodeHeader(opts.subject.replace(/[\r\n]+/g, " "))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type: string, body: string) =>
    [
      `--${boundary}`,
      `Content-Type: ${type}; charset="UTF-8"`,
      "Content-Transfer-Encoding: base64",
      "",
      wrap76(base64Utf8(body)),
    ].join("\r\n");
  return [...headers, "", part("text/plain", opts.text), part("text/html", opts.html), `--${boundary}--`, ""].join("\r\n");
}

export const toGmailRaw = (mime: string) => base64Url(mime);
