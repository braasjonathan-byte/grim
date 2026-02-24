export interface SvgExercise {
  name: string;
  detail: string;
}

export interface SvgStats {
  label: string;
  value: string;
}

export interface SvgCardTheme {
  bg: string;
  text: string;
  subtext: string;
  muted: string;
  statBg: string;
  exerciseBg: string;
  border: string;
  badgeBg: string;
}

export interface SvgCardInput {
  sessionName: string;
  subtitle: string;
  stats: SvgStats[];
  exercises: SvgExercise[];
  isRunning: boolean;
  logoBase64: string;
  theme: SvgCardTheme;
}

/* ── helpers ─────────────────────────────────────── */

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseGradient(css: string, id: string): string {
  const angleMatch = css.match(/(\d+)deg/);
  const angle = angleMatch ? parseInt(angleMatch[1]) : 180;
  const rad = ((angle - 90) * Math.PI) / 180;
  const x1 = (0.5 - 0.5 * Math.cos(rad)).toFixed(3);
  const y1 = (0.5 - 0.5 * Math.sin(rad)).toFixed(3);
  const x2 = (0.5 + 0.5 * Math.cos(rad)).toFixed(3);
  const y2 = (0.5 + 0.5 * Math.sin(rad)).toFixed(3);

  const colors: { color: string; offset: string }[] = [];
  const re = /(#[0-9a-fA-F]{3,8})\s*(\d+%)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    colors.push({ color: m[1], offset: m[2] || "" });
  }
  colors.forEach((c, i) => {
    if (!c.offset) {
      c.offset =
        colors.length === 1
          ? "0%"
          : `${Math.round((i / (colors.length - 1)) * 100)}%`;
    }
  });

  const stops = colors
    .map((c) => `<stop offset="${c.offset}" stop-color="${c.color}"/>`)
    .join("");
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
}

/** Parse rgba(r,g,b,a) → {fill, opacity} for SVG attributes */
function rgbaToSvg(rgba: string): { fill: string; opacity: number } {
  const m = rgba.match(
    /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\s*\)/
  );
  if (m) {
    const hex = `#${parseInt(m[1]).toString(16).padStart(2, "0")}${parseInt(m[2]).toString(16).padStart(2, "0")}${parseInt(m[3]).toString(16).padStart(2, "0")}`;
    return { fill: hex, opacity: m[4] ? parseFloat(m[4]) : 1 };
  }
  return { fill: rgba, opacity: 1 };
}

/* ── main builder ────────────────────────────────── */

export function buildWorkoutCardSvg(input: SvgCardInput): string {
  const W = 360;
  const H = 640;
  const P = 24;
  const t = input.theme;

  // ── Gradient defs ──
  const defs = [
    parseGradient(t.bg, "bg-grad"),
    parseGradient(t.badgeBg, "badge-grad"),
    `<clipPath id="logo-clip"><rect x="${P}" y="${P}" width="64" height="64" rx="14"/></clipPath>`,
  ].join("\n");

  const els: string[] = [];

  // ── Background ──
  els.push(`<rect width="${W}" height="${H}" rx="16" fill="url(#bg-grad)"/>`);

  // ── Logo ──
  els.push(
    `<image href="${input.logoBase64}" x="${P}" y="${P}" width="64" height="64" clip-path="url(#logo-clip)" preserveAspectRatio="xMidYMid slice"/>`
  );

  // ── Title & subtitle ──
  const txX = P + 76;
  els.push(
    `<text x="${txX}" y="${P + 28}" fill="${t.text}" font-size="16" font-weight="700">${esc(input.sessionName)}</text>`
  );
  els.push(
    `<text x="${txX}" y="${P + 48}" fill="${t.subtext}" font-size="12">${esc(input.subtitle)}</text>`
  );

  let y = P + 80;

  // ── Stats row ──
  const { stats } = input;
  if (stats.length > 0) {
    const gap = 8;
    const n = stats.length;
    const cw = (W - 2 * P - (n - 1) * gap) / n;
    const ch = 56;
    const { fill: sf, opacity: so } = rgbaToSvg(t.statBg);

    stats.forEach((s, i) => {
      const cx = P + i * (cw + gap);
      els.push(
        `<rect x="${cx}" y="${y}" width="${cw}" height="${ch}" rx="12" fill="${sf}" fill-opacity="${so}"/>`
      );
      els.push(
        `<text x="${cx + cw / 2}" y="${y + 22}" fill="${t.text}" font-size="24" font-weight="700" text-anchor="middle" dy="0.35em">${esc(s.value)}</text>`
      );
      els.push(
        `<text x="${cx + cw / 2}" y="${y + 44}" fill="${t.muted}" font-size="9" text-anchor="middle" dy="0.35em" letter-spacing="1">${esc(s.label.toUpperCase())}</text>`
      );
    });

    y += ch + 12;
  }

  // ── Exercises ──
  const maxEx = 8;
  const visibleExercises = input.exercises.slice(0, maxEx);
  const hiddenCount = input.exercises.length - visibleExercises.length;

  if (visibleExercises.length > 0) {
    const ep = 12;
    const headerH = 22;
    const nameH = 18;
    const detailH = 15;

    let contentH = ep + headerH;
    visibleExercises.forEach((ex) => {
      contentH += nameH;
      if (ex.detail) contentH += detailH;
    });
    if (hiddenCount > 0) contentH += nameH;
    contentH += ep;

    const bx = P;
    const bw = W - 2 * P;
    const { fill: ef, opacity: eo } = rgbaToSvg(t.exerciseBg);
    const { fill: bf, opacity: bo } = rgbaToSvg(t.border);

    els.push(
      `<rect x="${bx}" y="${y}" width="${bw}" height="${contentH}" rx="12" fill="${ef}" fill-opacity="${eo}" stroke="${bf}" stroke-opacity="${bo}" stroke-width="1"/>`
    );

    let ty = y + ep + 12;
    els.push(
      `<text x="${bx + ep}" y="${ty}" fill="${t.muted}" font-size="10" font-weight="700" letter-spacing="1">${input.isRunning ? "KONDITION" : "ÖVNINGAR"}</text>`
    );
    ty += headerH;

    visibleExercises.forEach((ex) => {
      els.push(
        `<text x="${bx + ep}" y="${ty}" fill="${t.text}" font-size="12" font-weight="600">${esc(ex.name)}</text>`
      );
      ty += nameH;
      if (ex.detail) {
        els.push(
          `<text x="${bx + ep}" y="${ty}" fill="${t.subtext}" font-size="10" font-family="'Lora',Georgia,serif" letter-spacing="0.02em">${esc(ex.detail)}</text>`
        );
        ty += detailH;
      }
    });

    if (hiddenCount > 0) {
      els.push(
        `<text x="${bx + ep}" y="${ty}" fill="${t.muted}" font-size="11" font-style="italic">+ ${hiddenCount} till</text>`
      );
    }

    y += contentH + 12;
  }

  // ── #BeGrim badge ──
  const bw = 120;
  const bh = 32;
  els.push(
    `<rect x="${(W - bw) / 2}" y="${y}" width="${bw}" height="${bh}" rx="16" fill="url(#badge-grad)"/>`
  );
  els.push(
    `<text x="${W / 2}" y="${y + bh / 2}" fill="#fff" font-size="14" font-weight="700" font-family="'Lora',Georgia,serif" letter-spacing="0.05em" text-anchor="middle" dy="0.35em">#BeGrim</text>`
  );
  y += bh + 12;


  // ── Footer ──
  els.push(
    `<text x="${P}" y="${H - P}" fill="${t.muted}" font-size="11" font-weight="700" letter-spacing="1">🔥 GRIM</text>`
  );
  els.push(
    `<text x="${W - P}" y="${H - P}" fill="${t.muted}" font-size="12" font-weight="500" text-anchor="end">Ladda ner → grim.lovable.app</text>`
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs>${defs}</defs>
<style>text{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;}</style>
${els.join("\n")}
</svg>`;
}
