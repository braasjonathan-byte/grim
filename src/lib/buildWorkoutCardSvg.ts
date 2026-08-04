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
  /** Key into SPORT_VISUALS for icon + accent colour */
  sportKey?: SportKey;
  stats: SvgStats[];
  exercises: SvgExercise[];
  isRunning: boolean;
  logoBase64: string;
  variant: ShareCardVariant;
  /** Optional user-supplied background photo (base64 data URL). */
  userPhotoBase64?: string;
}

/* ── sport identity (icon + accent), mirrors the app's lucide icons ── */

export type SportKey =
  | "run"
  | "bike"
  | "swim"
  | "row"
  | "ski"
  | "walk"
  | "triathlon"
  | "mobility"
  | "cardio"
  | "strength";

/** 24×24 stroke paths (lucide geometry) drawn with stroke-width 2. */
export const SPORT_VISUALS: Record<SportKey, { accent: string; path: string }> = {
  // Footprints
  run: { accent: "#2563eb", path: "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z M16 17h4 M4 13h4" },
  // Bike
  bike: { accent: "#0ea5e9", path: "M18.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M5.5 17.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M12 17.5V14l-3-3 4-3 2 3h2" },
  // Waves
  swim: { accent: "#06b6d4", path: "M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1 .6-.5 1.2-1 2.5-1 1.3 0 1.9.5 2.5 1 M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1 .6-.5 1.2-1 2.5-1 1.3 0 1.9.5 2.5 1 M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 1.3 0 1.9-.5 2.5-1 .6-.5 1.2-1 2.5-1 1.3 0 1.9.5 2.5 1" },
  // Sailboat-ish rowing
  row: { accent: "#14b8a6", path: "M4 20h16 M6 16 3 9h18l-3 7 M12 9V3 M8 9c0-2 1.8-4 4-4s4 2 4 4" },
  // Snowflake
  ski: { accent: "#6366f1", path: "M12 2v20 M4.9 6.5l14.2 11 M19.1 6.5l-14.2 11 M9 4l3 2 3-2 M9 20l3-2 3 2" },
  // Walk / footsteps
  walk: { accent: "#0d9488", path: "M13 4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z M9 20l3-6 M14 22l-2-5-3-3 1-5 3 2 2 3 3 1 M6 12l1-3" },
  // Zap
  triathlon: { accent: "#7c3aed", path: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z" },
  // Heart-ish / mobility
  mobility: { accent: "#a855f7", path: "M12 5c1.5-1.8 3.4-2.5 5-2.5A4.7 4.7 0 0 1 21.5 8c0 4.5-6 8.5-9.5 11.5C8.5 16.5 2.5 12.5 2.5 8A4.7 4.7 0 0 1 7 2.5c1.6 0 3.5.7 5 2.5Z" },
  // Activity pulse
  cardio: { accent: "#ef4444", path: "M22 12h-4l-3 9L9 3l-3 9H2" },
  // Dumbbell
  strength: { accent: "#2563eb", path: "M14.4 14.4 9.6 9.6 M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l1.767-1.768a2 2 0 1 1 2.829 2.829z M2.5 21.5l1.4-1.4 M21.5 2.5l-1.4 1.4 M5.343 2.515a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829L6.404 12.768a2 2 0 1 1-2.829-2.829l-1.767 1.768a2 2 0 1 1-2.829-2.829z" },
};

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
  const baseTheme = SHARE_CARD_THEMES[input.variant] ?? SHARE_CARD_THEMES.light;
  const sportVisual = input.sportKey ? SPORT_VISUALS[input.sportKey] : undefined;
  // Sport accent tints light/dark cards; the primary card keeps its white accent
  const t: SvgCardTheme =
    sportVisual && input.variant !== "primary"
      ? { ...baseTheme, accent: sportVisual.accent }
      : baseTheme;

  // Unique suffix so multiple cards on the same page never share gradient IDs
  const uid = `c${Math.random().toString(36).slice(2, 8)}`;
  const ID = {
    bg: `bg-${uid}`,
    dots: `dots-${uid}`,
    logo: `logo-${uid}`,
    glow: `glow-${uid}`,
  };

  const defs = [
    `<linearGradient id="${ID.bg}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0%" stop-color="${t.bgFrom}"/><stop offset="100%" stop-color="${t.bgTo}"/></linearGradient>`,
    `<pattern id="${ID.dots}" width="48" height="48" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="3" fill="${t.text}" fill-opacity="0.05"/></pattern>`,
    `<clipPath id="${ID.logo}"><rect x="${P}" y="${P}" width="104" height="104" rx="30"/></clipPath>`,
    `<radialGradient id="${ID.glow}" cx="0.5" cy="0.5" r="0.5"><stop offset="0%" stop-color="${t.accent}" stop-opacity="0.28"/><stop offset="100%" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>`,
  ].join("\n");

  const els: string[] = [];

  /* Background */
  els.push(`<rect width="${W}" height="${H}" fill="url(#${ID.bg})"/>`);
  els.push(`<rect width="${W}" height="${H}" fill="url(#${ID.dots})"/>`);
  els.push(`<circle cx="${W - 120}" cy="330" r="520" fill="url(#${ID.glow})"/>`);
  els.push(`<circle cx="60" cy="${H - 240}" r="440" fill="url(#${ID.glow})"/>`);

  if (input.userPhotoBase64) {
    els.push(
      `<image href="${input.userPhotoBase64}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity="0.5"/>`
    );
    els.push(`<rect width="${W}" height="${H}" fill="${t.bgTo}" fill-opacity="0.55"/>`);
  }

  /* ── Header row: logo + wordmark + meta ── */
  els.push(
    `<image href="${input.logoBase64}" x="${P}" y="${P}" width="104" height="104" clip-path="url(#${ID.logo})" preserveAspectRatio="xMidYMid slice"/>`
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
      const valFs = Math.min(84, Math.max(46, Math.floor((rowW - 80) / Math.max(3, s.value.length) * 1.7)));
      els.push(
        `<text x="${cx + 40}" y="${cy + ch - 78}" fill="${t.text}" font-size="${valFs}" font-family="${SANS}" font-weight="700" letter-spacing="-1">${esc(ellipsize(s.value, valFs, rowW - 80, 0.58))}</text>`
      );
      els.push(
        `<text x="${cx + 40}" y="${cy + ch - 38}" fill="${t.muted}" font-size="24" font-family="${SANS}" font-weight="600" letter-spacing="3">${esc(s.label.toUpperCase())}</text>`
      );
    });
    y += rows * ch + (rows - 1) * gap + 34;
  }

  /* ── Exercise panel (fills remaining space down to footer) ── */
  const footerY = H - P - 40;
  const panelBottom = footerY - 56;
  const panelH = panelBottom - y;
  const ip = 44;
  const headH = 96;
  const minRow = 92;
  const maxRow = 176;
  const avail = panelH - headH - ip;
  const maxRows = Math.max(0, Math.floor(avail / minRow));
  const visible = input.exercises.slice(0, maxRows);
  const hidden = input.exercises.length - visible.length;
  // Spread rows evenly so the panel never looks half empty
  const rowH = visible.length > 0
    ? Math.min(maxRow, Math.max(minRow, avail / (visible.length + (hidden > 0 ? 1 : 0))))
    : minRow;

  if (panelH > 200) {
    els.push(
      `<rect x="${P}" y="${y}" width="${CW}" height="${panelH}" rx="40" fill="${t.panel}" fill-opacity="${t.panelOpacity}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`
    );
    let ty = y + ip + 34;
    els.push(
      `<text x="${P + ip}" y="${ty}" fill="${t.muted}" font-size="24" font-family="${SANS}" font-weight="700" letter-spacing="4">${input.isRunning ? "PASSET" : "ÖVNINGAR"}</text>`
    );
    ty += 62;

    visible.forEach((ex, idx) => {
      els.push(`<circle cx="${P + ip + 7}" cy="${ty - 11}" r="7" fill="${t.accent}"/>`);
      els.push(
        `<text x="${P + ip + 34}" y="${ty}" fill="${t.text}" font-size="34" font-family="${SANS}" font-weight="600">${esc(ellipsize(ex.name, 34, CW - 2 * ip - 44, 0.55))}</text>`
      );
      if (ex.detail) {
        els.push(
          `<text x="${P + ip + 34}" y="${ty + 38}" fill="${t.subtext}" font-size="26" font-family="${SANS}" font-weight="500">${esc(ellipsize(ex.detail, 26, CW - 2 * ip - 44, 0.55))}</text>`
        );
      }
      if (idx < visible.length - 1) {
        els.push(
          `<line x1="${P + ip}" y1="${ty + rowH - 44}" x2="${P + CW - ip}" y2="${ty + rowH - 44}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`
        );
      }
      ty += rowH;
    });

    if (hidden > 0) {
      els.push(
        `<text x="${P + ip + 34}" y="${Math.min(ty + 6, y + panelH - 40)}" fill="${t.muted}" font-size="26" font-family="${SANS}" font-weight="600">+ ${hidden} till</text>`
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
