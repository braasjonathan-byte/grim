export interface SvgExercise {
  name: string;
  detail: string;
}

export interface SvgStats {
  label: string;
  value: string;
}

export type ShareCardVariant = "light" | "primary" | "dark";

export interface SvgCardTheme {
  bgFrom: string;
  bgTo: string;
  text: string;
  subtext: string;
  muted: string;
  panel: string;
  panelOpacity: number;
  border: string;
  borderOpacity: number;
  accent: string;
  onAccent: string;
}

export interface SvgCardInput {
  sessionName: string;
  /** e.g. "Vecka 3 · 5 jun" */
  metaLine: string;
  nickname: string;
  /** Short sport/type label, e.g. "LÖPNING" or "STYRKA" */
  sportLabel: string;
  stats: SvgStats[];
  exercises: SvgExercise[];
  isRunning: boolean;
  logoBase64: string;
  variant: ShareCardVariant;
  /** Optional user-supplied background photo (base64 data URL). */
  userPhotoBase64?: string;
}

/* ── canvas constants ─────────────────────────────── */

export const CARD_W = 1080;
export const CARD_H = 1920;

const MARKER = `'Permanent Marker', cursive`;
const SANS = `'Space Grotesk', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Space+Grotesk:wght@400;500;600;700&display=swap');`;

/* ── themes ───────────────────────────────────────── */

export const SHARE_CARD_THEMES: Record<ShareCardVariant, SvgCardTheme & { label: string }> = {
  light: {
    label: "Ljust",
    bgFrom: "#ffffff",
    bgTo: "#e8eefc",
    text: "#0b1220",
    subtext: "#41506b",
    muted: "#7b89a3",
    panel: "#ffffff",
    panelOpacity: 0.78,
    border: "#0b1220",
    borderOpacity: 0.08,
    accent: "#2563eb",
    onAccent: "#ffffff",
  },
  primary: {
    label: "Blått",
    bgFrom: "#1d4ed8",
    bgTo: "#0b1e4d",
    text: "#ffffff",
    subtext: "#cddcff",
    muted: "#9db4ea",
    panel: "#ffffff",
    panelOpacity: 0.12,
    border: "#ffffff",
    borderOpacity: 0.22,
    accent: "#ffffff",
    onAccent: "#1d4ed8",
  },
  dark: {
    label: "Mörkt",
    bgFrom: "#12151c",
    bgTo: "#05070b",
    text: "#ffffff",
    subtext: "#b8c2d4",
    muted: "#7c879b",
    panel: "#ffffff",
    panelOpacity: 0.07,
    border: "#ffffff",
    borderOpacity: 0.14,
    accent: "#4f8dff",
    onAccent: "#06101f",
  },
};

/* ── helpers ─────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rough width estimate so long titles can be scaled/wrapped without measuring. */
function textWidth(s: string, fontSize: number, factor = 0.56): number {
  return s.length * fontSize * factor;
}

function wrap(s: string, fontSize: number, maxWidth: number, maxLines: number, factor = 0.56): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (textWidth(next, fontSize, factor) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (textWidth(last, fontSize, factor) > maxWidth && last.length > 1) last = last.slice(0, -1);
    if (last !== lines[maxLines - 1]) lines[maxLines - 1] = last.replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

function ellipsize(s: string, fontSize: number, maxWidth: number, factor = 0.56): string {
  if (textWidth(s, fontSize, factor) <= maxWidth) return s;
  let out = s;
  while (out.length > 2 && textWidth(out + "…", fontSize, factor) > maxWidth) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

/* ── main builder ────────────────────────────────── */

export function buildWorkoutCardSvg(input: SvgCardInput): string {
  const W = CARD_W;
  const H = CARD_H;
  const P = 84;
  const CW = W - 2 * P;
  const t = SHARE_CARD_THEMES[input.variant] ?? SHARE_CARD_THEMES.light;

  const defs = [
    `<linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0%" stop-color="${t.bgFrom}"/><stop offset="100%" stop-color="${t.bgTo}"/></linearGradient>`,
    `<pattern id="dots" width="48" height="48" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="3" fill="${t.text}" fill-opacity="0.05"/></pattern>`,
    `<clipPath id="logoClip"><rect x="${P}" y="${P}" width="104" height="104" rx="30"/></clipPath>`,
    `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0%" stop-color="${t.accent}" stop-opacity="0.28"/><stop offset="100%" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>`,
  ].join("\n");

  const els: string[] = [];

  /* Background */
  els.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);
  els.push(`<rect width="${W}" height="${H}" fill="url(#dots)"/>`);
  els.push(`<circle cx="${W - 120}" cy="330" r="520" fill="url(#glow)"/>`);
  els.push(`<circle cx="60" cy="${H - 240}" r="440" fill="url(#glow)"/>`);
  if (input.userPhotoBase64) {
    els.push(
      `<image href="${input.userPhotoBase64}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity="0.5"/>`
    );
    els.push(`<rect width="${W}" height="${H}" fill="${t.bgTo}" fill-opacity="0.55"/>`);
  }

  /* ── Header row: logo + wordmark + meta ── */
  els.push(
    `<image href="${input.logoBase64}" x="${P}" y="${P}" width="104" height="104" clip-path="url(#logoClip)" preserveAspectRatio="xMidYMid slice"/>`
  );
  els.push(
    `<text x="${P + 128}" y="${P + 46}" fill="${t.text}" font-size="40" font-family="${MARKER}">Grim</text>`
  );
  els.push(
    `<text x="${P + 128}" y="${P + 84}" fill="${t.muted}" font-size="24" font-family="${SANS}" font-weight="500" letter-spacing="2">@${esc(input.nickname)}</text>`
  );
  els.push(
    `<text x="${W - P}" y="${P + 66}" fill="${t.subtext}" font-size="26" font-family="${SANS}" font-weight="500" text-anchor="end">${esc(input.metaLine)}</text>`
  );

  let y = P + 190;

  /* ── Sport chip ── */
  const chipLabel = input.sportLabel.toUpperCase();
  const chipFs = 26;
  const chipW = Math.max(150, textWidth(chipLabel, chipFs, 0.68) + 64);
  els.push(
    `<rect x="${P}" y="${y}" width="${chipW}" height="58" rx="29" fill="${t.accent}"/>`
  );
  els.push(
    `<text x="${P + chipW / 2}" y="${y + 29}" fill="${t.onAccent}" font-size="${chipFs}" font-family="${SANS}" font-weight="700" letter-spacing="3" text-anchor="middle" dy="0.35em">${esc(chipLabel)}</text>`
  );
  y += 58 + 40;

  /* ── Session title (marker font, branding/heading only) ── */
  let titleFs = 104;
  let titleLines = wrap(input.sessionName, titleFs, CW, 2, 0.6);
  while (titleLines.length > 1 && titleFs > 62 && textWidth(input.sessionName, titleFs, 0.6) > CW * 1.9) {
    titleFs -= 8;
    titleLines = wrap(input.sessionName, titleFs, CW, 2, 0.6);
  }
  titleLines.forEach((line, i) => {
    els.push(
      `<text x="${P}" y="${y + titleFs * 0.78 + i * titleFs * 1.08}" fill="${t.text}" font-size="${titleFs}" font-family="${MARKER}">${esc(line)}</text>`
    );
  });
  y += titleLines.length * titleFs * 1.08 + 56;

  /* ── Hero stats ── */
  const stats = input.stats.slice(0, 4);
  if (stats.length > 0) {
    const gap = 20;
    const perRow = stats.length <= 2 ? stats.length : 2;
    const rows = Math.ceil(stats.length / perRow);
    const cw = (CW - (perRow - 1) * gap) / perRow;
    const ch = rows === 1 ? 220 : 190;

    stats.forEach((s, i) => {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const rowCount = Math.min(perRow, stats.length - r * perRow);
      const rowW = (CW - (rowCount - 1) * gap) / rowCount;
      const cx = P + c * (rowW + gap);
      const cy = y + r * (ch + gap);
      els.push(
        `<rect x="${cx}" y="${cy}" width="${rowW}" height="${ch}" rx="34" fill="${t.panel}" fill-opacity="${t.panelOpacity}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`
      );
      els.push(`<rect x="${cx + 34}" y="${cy + 40}" width="56" height="6" rx="3" fill="${t.accent}"/>`);
      const valFs = Math.min(84, Math.max(46, Math.floor((rowW - 80) / Math.max(3, s.value.length) * 1.7)));
      els.push(
        `<text x="${cx + 34}" y="${cy + ch - 74}" fill="${t.text}" font-size="${valFs}" font-family="${SANS}" font-weight="700" letter-spacing="-1">${esc(ellipsize(s.value, valFs, rowW - 68, 0.58))}</text>`
      );
      els.push(
        `<text x="${cx + 34}" y="${cy + ch - 34}" fill="${t.muted}" font-size="24" font-family="${SANS}" font-weight="600" letter-spacing="3">${esc(s.label.toUpperCase())}</text>`
      );
    });
    y += rows * ch + (rows - 1) * gap + 34;
  }

  /* ── Exercise panel (fills remaining space down to footer) ── */
  const footerY = H - P - 40;
  const panelBottom = footerY - 56;
  const panelH = panelBottom - y;
  const visible = input.exercises.slice(0, Math.max(0, Math.floor((panelH - 150) / 92)));
  const hidden = input.exercises.length - visible.length;

  if (panelH > 200) {
    els.push(
      `<rect x="${P}" y="${y}" width="${CW}" height="${panelH}" rx="40" fill="${t.panel}" fill-opacity="${t.panelOpacity}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`
    );
    const ip = 44;
    let ty = y + ip + 34;
    els.push(
      `<text x="${P + ip}" y="${ty}" fill="${t.muted}" font-size="24" font-family="${SANS}" font-weight="700" letter-spacing="4">${input.isRunning ? "PASSET" : "ÖVNINGAR"}</text>`
    );
    ty += 52;

    visible.forEach((ex, idx) => {
      els.push(
        `<circle cx="${P + ip + 7}" cy="${ty - 10}" r="7" fill="${t.accent}"/>`
      );
      els.push(
        `<text x="${P + ip + 32}" y="${ty}" fill="${t.text}" font-size="34" font-family="${SANS}" font-weight="600">${esc(ellipsize(ex.name, 34, CW - 2 * ip - 40, 0.55))}</text>`
      );
      if (ex.detail) {
        els.push(
          `<text x="${P + ip + 32}" y="${ty + 38}" fill="${t.subtext}" font-size="26" font-family="${SANS}" font-weight="500">${esc(ellipsize(ex.detail, 26, CW - 2 * ip - 40, 0.55))}</text>`
        );
      }
      ty += 92;
      if (idx < visible.length - 1) {
        els.push(
          `<line x1="${P + ip}" y1="${ty - 56}" x2="${P + CW - ip}" y2="${ty - 56}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`
        );
      }
    });

    if (hidden > 0) {
      els.push(
        `<text x="${P + ip + 32}" y="${Math.min(ty + 10, y + panelH - 34)}" fill="${t.muted}" font-size="26" font-family="${SANS}" font-weight="600">+ ${hidden} till</text>`
      );
    }
  }

  /* ── Footer ── */
  els.push(
    `<line x1="${P}" y1="${footerY - 34}" x2="${W - P}" y2="${footerY - 34}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`
  );
  els.push(
    `<text x="${P}" y="${footerY + 20}" fill="${t.text}" font-size="38" font-family="${MARKER}">Grim</text>`
  );
  els.push(
    `<text x="${W / 2}" y="${footerY + 20}" fill="${t.accent}" font-size="28" font-family="${SANS}" font-weight="700" letter-spacing="2" text-anchor="middle">#BeGrim</text>`
  );
  els.push(
    `<text x="${W - P}" y="${footerY + 18}" fill="${t.muted}" font-size="26" font-family="${SANS}" font-weight="500" text-anchor="end">grim.lovable.app</text>`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>${defs}</defs>
<style>${FONT_IMPORT} text{font-family:${SANS};}</style>
${els.join("\n")}
</svg>`;
}
