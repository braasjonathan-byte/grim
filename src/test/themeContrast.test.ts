import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "@/lib/themes";

/** Läser bas-tokens (:root resp. .dark) ur index.css. */
function baseTokens(selector: ":root" | ".dark"): Record<string, string> {
  const css = readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function lum(token: string): number {
  const m = token.trim().match(/^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) throw new Error(`bad token ${token}`);
  const h = Number(m[1]) / 360, s = Number(m[2]) / 100, l = Number(m[3]) / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const ch = (t: number) => {
    t = (t + 1) % 1;
    const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(h + 1 / 3) + 0.7152 * ch(h) + 0.0722 * ch(h - 1 / 3);
}
const ratio = (a: string, b: string) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

export const resolvedThemes = () => {
  const light = baseTokens(":root");
  const dark = { ...light, ...baseTokens(".dark") };
  const out: { id: string; mode: string; t: Record<string, string> }[] = [];
  for (const theme of THEMES) {
    const modes: ("light" | "dark")[] = theme.followSystem ? ["light", "dark"] : [theme.forceDark ? "dark" : "light"];
    for (const mode of modes) out.push({ id: theme.id, mode, t: { ...(mode === "dark" ? dark : light), ...theme[mode] } });
  }
  return out;
};

// Text som ligger på ytor (piller, chips, räknare) måste vara läsbar i alla teman.
const PAIRS: [fg: string, bg: string, min: number][] = [
  ["--foreground", "--background", 4.5],
  ["--foreground", "--card", 4.5],
  ["--foreground", "--secondary", 4.5],
  ["--foreground", "--muted", 4.5],
  ["--muted-foreground", "--background", 4.5],
  ["--muted-foreground", "--card", 4.5],
  ["--muted-foreground", "--secondary", 4.5],
  ["--muted-foreground", "--muted", 4.5],
];

describe("tema-kontrast", () => {
  for (const { id, mode, t } of resolvedThemes()) {
    it(`${id} (${mode}) har läsbar text på alla ytor`, () => {
      const fails = PAIRS.filter(([fg, bg, min]) => ratio(t[fg], t[bg]) < min).map(
        ([fg, bg]) => `${fg} på ${bg}: ${ratio(t[fg], t[bg]).toFixed(2)}`,
      );
      expect(fails).toEqual([]);
    });
  }
});

describe("enforceSurfaceContrast", () => {
  it("byter en mörk brandfärgad --secondary mot --muted så att text syns", async () => {
    const { enforceSurfaceContrast } = await import("@/lib/themes");
    const root = document.createElement("div");
    document.body.appendChild(root);
    root.style.setProperty("--foreground", "52 27% 22%");
    root.style.setProperty("--muted-foreground", "52 20% 32%");
    root.style.setProperty("--muted", "28 30% 85%");
    root.style.setProperty("--secondary", "52 27% 22%");
    enforceSurfaceContrast(root);
    expect(root.style.getPropertyValue("--secondary").trim()).toBe("28 30% 85%");
    expect(root.style.getPropertyValue("--secondary-foreground").trim()).toBe("52 27% 22%");
  });
  it("lämnar en läsbar --secondary orörd", async () => {
    const { enforceSurfaceContrast } = await import("@/lib/themes");
    const root = document.createElement("div");
    root.style.setProperty("--foreground", "0 0% 0%");
    root.style.setProperty("--muted-foreground", "0 0% 40%");
    root.style.setProperty("--muted", "0 0% 96%");
    root.style.setProperty("--secondary", "0 0% 96%");
    enforceSurfaceContrast(root);
    expect(root.style.getPropertyValue("--secondary").trim()).toBe("0 0% 96%");
  });
});
