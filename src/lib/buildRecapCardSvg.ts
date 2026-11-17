import { CARD_H, CARD_W, SHARE_CARD_THEMES, type ShareCardVariant, type SvgStats } from "./buildWorkoutCardSvg";

export interface RecapCardInput {
  /** Titel i marker-typsnittet, t.ex. "Min vecka" */
  title: string;
  /** Periodetikett, t.ex. "v. 47 · 10–16 nov" */
  periodLabel: string;
  nickname: string;
  /** Upp till 4 nyckeltal */
  stats: SvgStats[];
  /** Upp till 4 höjdpunktsrader */
  highlights: string[];
  logoBase64: string;
  variant: ShareCardVariant;
}

const MARKER = `'Permanent Marker', cursive`;
const SANS = `'Space Grotesk', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Permanent+Marker&amp;family=Space+Grotesk:wght@400;500;600;700&amp;display=swap');`;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function textWidth(s: string, fontSize: number, factor = 0.56): number {
  return s.length * fontSize * factor;
}

function ellipsize(s: string, fontSize: number, maxWidth: number, factor = 0.56): string {
  if (textWidth(s, fontSize, factor) <= maxWidth) return s;
  let out = s;
  while (out.length > 2 && textWidth(out + "…", fontSize, factor) > maxWidth) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

/** Delbart bildkort för vecko-/månads-/årssammanfattningar, i samma stil som passkorten. */
export function buildRecapCardSvg(input: RecapCardInput): string {
  const W = CARD_W;
  const H = CARD_H;
  const P = 84;
  const CW = W - 2 * P;
  const t = SHARE_CARD_THEMES[input.variant] ?? SHARE_CARD_THEMES.primary;

  const uid = `r${Math.random().toString(36).slice(2, 8)}`;
  const ID = { bg: `bg-${uid}`, dots: `dots-${uid}`, logo: `logo-${uid}`, glow: `glow-${uid}` };

  const defs = [
    `<linearGradient id="${ID.bg}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0%" stop-color="${t.bgFrom}"/><stop offset="100%" stop-color="${t.bgTo}"/></linearGradient>`,
    `<pattern id="${ID.dots}" width="48" height="48" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="3" fill="${t.text}" fill-opacity="0.05"/></pattern>`,
    `<clipPath id="${ID.logo}"><rect x="${P}" y="${P}" width="104" height="104" rx="30"/></clipPath>`,
    `<radialGradient id="${ID.glow}" cx="0.5" cy="0.5" r="0.5"><stop offset="0%" stop-color="${t.accent}" stop-opacity="0.28"/><stop offset="100%" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>`,
  ].join("\n");

  const els: string[] = [];
  els.push(`<rect width="${W}" height="${H}" fill="url(#${ID.bg})"/>`);
  els.push(`<rect width="${W}" height="${H}" fill="url(#${ID.dots})"/>`);
  els.push(`<circle cx="${W - 120}" cy="330" r="520" fill="url(#${ID.glow})"/>`);
  els.push(`<circle cx="60" cy="${H - 240}" r="440" fill="url(#${ID.glow})"/>`);

  /* Header: logo + ordmärke + period */
  if (input.logoBase64) {
    els.push(`<image href="${input.logoBase64}" x="${P}" y="${P}" width="104" height="104" clip-path="url(#${ID.logo})" preserveAspectRatio="xMidYMid slice"/>`);
  }
  els.push(`<text x="${P + 128}" y="${P + 46}" fill="${t.text}" font-size="40" font-family="${MARKER}">Grim</text>`);
  els.push(`<text x="${P + 128}" y="${P + 84}" fill="${t.muted}" font-size="24" font-family="${SANS}" font-weight="500" letter-spacing="2">@${esc(input.nickname)}</text>`);
  els.push(`<text x="${W - P}" y="${P + 66}" fill="${t.subtext}" font-size="26" font-family="${SANS}" font-weight="500" text-anchor="end">${esc(input.periodLabel)}</text>`);

  let y = P + 220;

  /* Titel */
  const titleFs = 110;
  els.push(`<text x="${P}" y="${y + titleFs * 0.78}" fill="${t.text}" font-size="${titleFs}" font-family="${MARKER}">${esc(ellipsize(input.title, titleFs, CW, 0.6))}</text>`);
  y += titleFs * 1.08 + 70;

  /* Nyckeltal 2×2 */
  const stats = input.stats.slice(0, 4);
  if (stats.length > 0) {
    const gap = 20;
    const perRow = stats.length <= 1 ? 1 : 2;
    const rows = Math.ceil(stats.length / perRow);
    const ch = 210;
    stats.forEach((s, i) => {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const rowCount = Math.min(perRow, stats.length - r * perRow);
      const rowW = (CW - (rowCount - 1) * gap) / rowCount;
      const cx = P + c * (rowW + gap);
      const cy = y + r * (ch + gap);
      els.push(`<rect x="${cx}" y="${cy}" width="${rowW}" height="${ch}" rx="34" fill="${t.panel}" fill-opacity="${t.panelOpacity}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`);
      const valFs = Math.min(84, Math.max(40, Math.floor(((rowW - 80) / Math.max(3, s.value.length)) * 1.7)));
      els.push(`<text x="${cx + 40}" y="${cy + ch - 78}" fill="${t.text}" font-size="${valFs}" font-family="${SANS}" font-weight="700" letter-spacing="-1">${esc(ellipsize(s.value, valFs, rowW - 80, 0.58))}</text>`);
      els.push(`<text x="${cx + 40}" y="${cy + ch - 38}" fill="${t.subtext}" font-size="24" font-family="${SANS}" font-weight="600" letter-spacing="3">${esc(s.label.toUpperCase())}</text>`);
    });
    y += rows * ch + (rows - 1) * gap + 60;
  }

  /* Höjdpunkter */
  const highlights = input.highlights.filter(Boolean).slice(0, 4);
  if (highlights.length > 0) {
    const ip = 44;
    const rowH = 74;
    const panelH = 96 + highlights.length * rowH + 20;
    els.push(`<rect x="${P}" y="${y}" width="${CW}" height="${panelH}" rx="40" fill="${t.panel}" fill-opacity="${t.panelOpacity}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`);
    let ty = y + ip + 34;
    els.push(`<text x="${P + ip}" y="${ty}" fill="${t.muted}" font-size="24" font-family="${SANS}" font-weight="700" letter-spacing="4">HÖJDPUNKTER</text>`);
    ty += 66;
    highlights.forEach((line) => {
      els.push(`<circle cx="${P + ip + 7}" cy="${ty - 11}" r="7" fill="${t.accent}"/>`);
      els.push(`<text x="${P + ip + 34}" y="${ty}" fill="${t.text}" font-size="32" font-family="${SANS}" font-weight="600">${esc(ellipsize(line, 32, CW - 2 * ip - 44, 0.55))}</text>`);
      ty += rowH;
    });
  }

  /* Footer */
  const footerY = H - P - 40;
  els.push(`<line x1="${P}" y1="${footerY - 34}" x2="${W - P}" y2="${footerY - 34}" stroke="${t.border}" stroke-opacity="${t.borderOpacity}" stroke-width="2"/>`);
  els.push(`<text x="${P}" y="${footerY + 20}" fill="${t.accent}" font-size="30" font-family="${SANS}" font-weight="700" letter-spacing="2">#BeGrim</text>`);
  els.push(`<text x="${W - P}" y="${footerY + 18}" fill="${t.muted}" font-size="26" font-family="${SANS}" font-weight="500" text-anchor="end">grim.lovable.app</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>${defs}</defs>
<style>${FONT_IMPORT} text{font-family:${SANS};}</style>
${els.join("\n")}
</svg>`;
}

/** Rasteriserar en SVG-sträng till en PNG-blob, samma teknik som passkorten. */
export async function svgToPngBlob(svgStr: string): Promise<Blob | null> {
  try {
    const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return await new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  } catch {
    return null;
  }
}
