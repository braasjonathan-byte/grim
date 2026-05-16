export interface ThemeDefinition {
  id: string;
  name: string;
  emoji: string;
  premium: boolean; // requires honorary status
  forceDark: boolean; // forces dark mode (all except "light")
  preview: { bg: string; card: string; accent: string };
  dark: Record<string, string>; // CSS var overrides (applied on top of base dark/light)
  light: Record<string, string>;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "default",
    name: "Standard",
    emoji: "⬛",
    premium: false,
    forceDark: true,
    preview: { bg: "#141c24", card: "#1f2937", accent: "#ffffff" },
    light: {},
    dark: {},
  },
  {
    id: "light",
    name: "Ljust",
    emoji: "☀️",
    premium: false,
    forceDark: false,
    preview: { bg: "#ffffff", card: "#ffffff", accent: "#000000" },
    light: {},
    dark: {},
  },
  {
    id: "neon",
    name: "Neon",
    emoji: "💚",
    premium: true,
    forceDark: true,
    preview: { bg: "#0a0f0a", card: "#0f1a0f", accent: "#39ff14" },
    light: {},
    dark: {
      "--background": "130 30% 6%",
      "--card": "130 25% 11%",
      "--card-foreground": "0 0% 100%",
      "--popover": "130 25% 10%",
      "--secondary": "130 20% 14%",
      "--muted": "130 15% 14%",
      "--accent": "120 30% 18%",
      "--accent-foreground": "120 100% 70%",
      "--primary": "120 100% 55%",
      "--primary-foreground": "0 0% 0%",
      "--ring": "120 100% 55%",
      "--border": "120 100% 55%",
      "--input": "120 100% 55%",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    emoji: "🌊",
    premium: true,
    forceDark: true,
    preview: { bg: "#0c1929", card: "#132f4c", accent: "#29b6f6" },
    light: {},
    dark: {
      "--background": "210 40% 7%",
      "--card": "210 35% 12%",
      "--card-foreground": "0 0% 100%",
      "--popover": "210 35% 10%",
      "--secondary": "210 25% 15%",
      "--muted": "210 20% 15%",
      "--accent": "199 30% 18%",
      "--accent-foreground": "199 89% 70%",
      "--primary": "199 89% 60%",
      "--primary-foreground": "0 0% 0%",
      "--ring": "199 89% 60%",
      "--border": "199 89% 60%",
      "--input": "199 89% 60%",
    },
  },
  {
    id: "blood",
    name: "Blod",
    emoji: "🩸",
    premium: true,
    forceDark: true,
    preview: { bg: "#1a0a0a", card: "#2d1111", accent: "#dc2626" },
    light: {},
    dark: {
      "--background": "0 40% 6%",
      "--card": "0 30% 12%",
      "--card-foreground": "0 0% 100%",
      "--popover": "0 30% 10%",
      "--secondary": "0 25% 15%",
      "--muted": "0 20% 15%",
      "--accent": "0 30% 18%",
      "--accent-foreground": "0 72% 70%",
      "--primary": "0 72% 55%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "0 72% 55%",
      "--border": "0 72% 55%",
      "--input": "0 72% 55%",
    },
  },
  {
    id: "gold",
    name: "Guld",
    emoji: "👑",
    premium: true,
    forceDark: true,
    preview: { bg: "#1a1508", card: "#2d2510", accent: "#fbbf24" },
    light: {},
    dark: {
      "--background": "40 40% 5%",
      "--card": "40 30% 11%",
      "--card-foreground": "0 0% 100%",
      "--popover": "40 30% 9%",
      "--secondary": "40 25% 14%",
      "--muted": "40 20% 14%",
      "--accent": "43 30% 18%",
      "--accent-foreground": "43 96% 70%",
      "--primary": "43 96% 56%",
      "--primary-foreground": "0 0% 0%",
      "--ring": "43 96% 56%",
      "--border": "43 96% 56%",
      "--input": "43 96% 56%",
    },
  },
  {
    id: "purple",
    name: "Lila",
    emoji: "🔮",
    premium: true,
    forceDark: true,
    preview: { bg: "#150a2e", card: "#1e1145", accent: "#a855f7" },
    light: {},
    dark: {
      "--background": "270 40% 6%",
      "--card": "270 30% 12%",
      "--card-foreground": "0 0% 100%",
      "--popover": "270 30% 10%",
      "--secondary": "270 25% 15%",
      "--muted": "270 20% 15%",
      "--accent": "270 30% 18%",
      "--accent-foreground": "270 91% 75%",
      "--primary": "270 91% 65%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "270 91% 65%",
      "--border": "270 91% 65%",
      "--input": "270 91% 65%",
    },
  },
  {
    id: "frost",
    name: "Frost",
    emoji: "🧊",
    premium: true,
    forceDark: true,
    preview: { bg: "#0a1520", card: "#112030", accent: "#7dd3fc" },
    light: {},
    dark: {
      "--background": "210 50% 7%",
      "--card": "210 40% 12%",
      "--card-foreground": "0 0% 100%",
      "--popover": "210 40% 10%",
      "--secondary": "210 30% 15%",
      "--muted": "210 25% 15%",
      "--accent": "200 30% 20%",
      "--accent-foreground": "200 80% 75%",
      "--primary": "200 80% 70%",
      "--primary-foreground": "210 50% 7%",
      "--ring": "200 80% 70%",
      "--border": "200 60% 50%",
      "--input": "200 60% 50%",
    },
  },
  {
    id: "ember",
    name: "Glöd",
    emoji: "🔥",
    premium: true,
    forceDark: true,
    preview: { bg: "#1a0f05", card: "#2d1a0a", accent: "#f97316" },
    light: {},
    dark: {
      "--background": "25 50% 5%",
      "--card": "25 35% 11%",
      "--card-foreground": "0 0% 100%",
      "--popover": "25 35% 9%",
      "--secondary": "25 25% 14%",
      "--muted": "25 20% 14%",
      "--accent": "25 30% 18%",
      "--accent-foreground": "25 90% 70%",
      "--primary": "25 95% 55%",
      "--primary-foreground": "0 0% 0%",
      "--ring": "25 95% 55%",
      "--border": "25 95% 55%",
      "--input": "25 95% 55%",
    },
  },
  {
    id: "sakura",
    name: "Sakura",
    emoji: "🌸",
    premium: true,
    forceDark: true,
    preview: { bg: "#1a0a18", card: "#2d1128", accent: "#f472b6" },
    light: {},
    dark: {
      "--background": "310 40% 6%",
      "--card": "310 30% 12%",
      "--card-foreground": "0 0% 100%",
      "--popover": "310 30% 10%",
      "--secondary": "310 25% 15%",
      "--muted": "310 20% 15%",
      "--accent": "330 30% 18%",
      "--accent-foreground": "330 80% 75%",
      "--primary": "330 80% 65%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "330 80% 65%",
      "--border": "330 80% 65%",
      "--input": "330 80% 65%",
    },
  },
  {
    id: "darkgreen",
    name: "Mörkgrön",
    emoji: "🌲",
    premium: true,
    forceDark: true,
    preview: { bg: "#0a1a0f", card: "#122618", accent: "#22c55e" },
    light: {},
    dark: {
      "--background": "145 35% 6%",
      "--card": "145 30% 11%",
      "--card-foreground": "0 0% 100%",
      "--popover": "145 30% 9%",
      "--secondary": "145 22% 14%",
      "--muted": "145 18% 14%",
      "--accent": "145 25% 18%",
      "--accent-foreground": "142 70% 65%",
      "--primary": "142 70% 45%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "142 70% 45%",
      "--border": "142 50% 35%",
      "--input": "142 50% 35%",
    },
  },
  {
    id: "goth",
    name: "Goth",
    emoji: "🦇",
    premium: true,
    forceDark: true,
    preview: { bg: "#0a0a0a", card: "#141414", accent: "#8b0000" },
    light: {},
    dark: {
      "--background": "0 0% 4%",
      "--card": "0 0% 8%",
      "--card-foreground": "0 0% 80%",
      "--popover": "0 0% 7%",
      "--secondary": "0 0% 11%",
      "--muted": "0 0% 12%",
      "--accent": "0 50% 12%",
      "--accent-foreground": "0 60% 55%",
      "--primary": "0 100% 30%",
      "--primary-foreground": "0 0% 90%",
      "--ring": "0 100% 30%",
      "--border": "0 30% 20%",
      "--input": "0 30% 20%",
      "--warning": "0 80% 35%",
      "--destructive": "0 60% 25%",
    },
  },
  // ───── Light premium themes (honorary only) ─────
  {
    id: "linen",
    name: "Linne",
    emoji: "🤍",
    premium: true,
    forceDark: false,
    preview: { bg: "#faf7f2", card: "#ffffff", accent: "#8b7355" },
    dark: {},
    light: {
      "--background": "36 30% 97%",
      "--foreground": "30 15% 15%",
      "--card": "0 0% 100%",
      "--card-foreground": "30 15% 15%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "30 15% 15%",
      "--secondary": "36 25% 92%",
      "--secondary-foreground": "30 15% 20%",
      "--muted": "36 20% 92%",
      "--muted-foreground": "30 10% 40%",
      "--accent": "32 30% 88%",
      "--accent-foreground": "28 35% 25%",
      "--primary": "28 40% 40%",
      "--primary-foreground": "36 30% 97%",
      "--ring": "28 40% 40%",
      "--border": "30 20% 85%",
      "--input": "30 20% 85%",
    },
  },
  {
    id: "sky",
    name: "Himmel",
    emoji: "🌤️",
    premium: true,
    forceDark: false,
    preview: { bg: "#f0f9ff", card: "#ffffff", accent: "#0284c7" },
    dark: {},
    light: {
      "--background": "204 100% 97%",
      "--foreground": "210 40% 15%",
      "--card": "0 0% 100%",
      "--card-foreground": "210 40% 15%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "210 40% 15%",
      "--secondary": "204 50% 92%",
      "--secondary-foreground": "210 40% 20%",
      "--muted": "204 40% 93%",
      "--muted-foreground": "210 20% 40%",
      "--accent": "199 80% 88%",
      "--accent-foreground": "200 90% 25%",
      "--primary": "200 90% 40%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "200 90% 40%",
      "--border": "204 40% 85%",
      "--input": "204 40% 85%",
    },
  },
  {
    id: "mint",
    name: "Mynta",
    emoji: "🌿",
    premium: true,
    forceDark: false,
    preview: { bg: "#f0fdf6", card: "#ffffff", accent: "#10b981" },
    dark: {},
    light: {
      "--background": "150 60% 97%",
      "--foreground": "155 30% 15%",
      "--card": "0 0% 100%",
      "--card-foreground": "155 30% 15%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "155 30% 15%",
      "--secondary": "150 35% 92%",
      "--secondary-foreground": "155 30% 20%",
      "--muted": "150 25% 93%",
      "--muted-foreground": "155 15% 40%",
      "--accent": "160 45% 88%",
      "--accent-foreground": "160 70% 22%",
      "--primary": "160 70% 35%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "160 70% 35%",
      "--border": "150 30% 85%",
      "--input": "150 30% 85%",
    },
  },
  {
    id: "rose",
    name: "Ros",
    emoji: "🌷",
    premium: true,
    forceDark: false,
    preview: { bg: "#fff1f5", card: "#ffffff", accent: "#e11d74" },
    dark: {},
    light: {
      "--background": "340 100% 98%",
      "--foreground": "340 30% 15%",
      "--card": "0 0% 100%",
      "--card-foreground": "340 30% 15%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "340 30% 15%",
      "--secondary": "340 40% 93%",
      "--secondary-foreground": "340 30% 20%",
      "--muted": "340 30% 94%",
      "--muted-foreground": "340 15% 40%",
      "--accent": "335 60% 90%",
      "--accent-foreground": "335 75% 30%",
      "--primary": "335 75% 50%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "335 75% 50%",
      "--border": "340 30% 88%",
      "--input": "340 30% 88%",
    },
  },
  {
    id: "lavender",
    name: "Lavendel",
    emoji: "💜",
    premium: true,
    forceDark: false,
    preview: { bg: "#f5f3ff", card: "#ffffff", accent: "#7c3aed" },
    dark: {},
    light: {
      "--background": "260 100% 98%",
      "--foreground": "265 30% 15%",
      "--card": "0 0% 100%",
      "--card-foreground": "265 30% 15%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "265 30% 15%",
      "--secondary": "260 40% 93%",
      "--secondary-foreground": "265 30% 20%",
      "--muted": "260 30% 94%",
      "--muted-foreground": "265 15% 40%",
      "--accent": "265 50% 90%",
      "--accent-foreground": "265 75% 30%",
      "--primary": "265 75% 55%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "265 75% 55%",
      "--border": "260 30% 88%",
      "--input": "260 30% 88%",
    },
  },
  {
    id: "peach",
    name: "Persika",
    emoji: "🍑",
    premium: true,
    forceDark: false,
    preview: { bg: "#fff4ed", card: "#ffffff", accent: "#fb7185" },
    dark: {},
    light: {
      "--background": "20 100% 97%",
      "--foreground": "15 35% 15%",
      "--card": "0 0% 100%",
      "--card-foreground": "15 35% 15%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "15 35% 15%",
      "--secondary": "20 60% 93%",
      "--secondary-foreground": "15 35% 20%",
      "--muted": "20 40% 94%",
      "--muted-foreground": "15 20% 40%",
      "--accent": "10 70% 90%",
      "--accent-foreground": "350 70% 30%",
      "--primary": "350 80% 60%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "350 80% 60%",
      "--border": "20 40% 88%",
      "--input": "20 40% 88%",
    },
  },
  {
    id: "graphite",
    name: "Grafit",
    emoji: "🪨",
    premium: true,
    forceDark: false,
    preview: { bg: "#f4f4f5", card: "#ffffff", accent: "#3f3f46" },
    dark: {},
    light: {
      "--background": "240 5% 96%",
      "--foreground": "240 10% 12%",
      "--card": "0 0% 100%",
      "--card-foreground": "240 10% 12%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "240 10% 12%",
      "--secondary": "240 5% 91%",
      "--secondary-foreground": "240 10% 18%",
      "--muted": "240 5% 92%",
      "--muted-foreground": "240 5% 40%",
      "--accent": "240 6% 87%",
      "--accent-foreground": "240 10% 20%",
      "--primary": "240 8% 25%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "240 8% 25%",
      "--border": "240 5% 84%",
      "--input": "240 5% 84%",
    },
  },
  {
    id: "sand",
    name: "Sand",
    emoji: "🏖️",
    premium: true,
    forceDark: false,
    preview: { bg: "#fdf8ed", card: "#ffffff", accent: "#d97706" },
    dark: {},
    light: {
      "--background": "45 80% 96%",
      "--foreground": "30 30% 15%",
      "--card": "0 0% 100%",
      "--card-foreground": "30 30% 15%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "30 30% 15%",
      "--secondary": "45 50% 91%",
      "--secondary-foreground": "30 30% 20%",
      "--muted": "45 35% 92%",
      "--muted-foreground": "30 15% 40%",
      "--accent": "35 70% 87%",
      "--accent-foreground": "30 75% 28%",
      "--primary": "30 80% 45%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "30 80% 45%",
      "--border": "40 35% 85%",
      "--input": "40 35% 85%",
    },
  },
];

const THEME_STORAGE_KEY = "gymberget_color_theme";

let themeLockOwner: string | null = null;

export function lockTheme(owner: string) {
  themeLockOwner = owner;
}

export function unlockTheme(owner: string) {
  if (themeLockOwner === owner) themeLockOwner = null;
}

export function isThemeLocked(): boolean {
  return themeLockOwner !== null;
}

export function getStoredThemeId(): string {
  return localStorage.getItem(THEME_STORAGE_KEY) || "default";
}

export function storeThemeId(id: string) {
  localStorage.setItem(THEME_STORAGE_KEY, id);
}

export function applyTheme(themeId: string) {
  const theme = THEMES.find((t) => t.id === themeId);
  if (!theme) return;

  const root = document.documentElement;

  // Set dark/light mode based on theme
  if (theme.forceDark) {
    root.classList.add("dark");
    root.classList.remove("light");
    localStorage.setItem("gymberget_theme", "dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#000000");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    localStorage.setItem("gymberget_theme", "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", "#ffffff");
  }

  // Collect all possible CSS variable keys across all themes
  const allKeys = new Set<string>();
  THEMES.forEach((t) => {
    Object.keys(t.light).forEach((k) => allKeys.add(k));
    Object.keys(t.dark).forEach((k) => allKeys.add(k));
  });

  // Remove all previous theme overrides
  allKeys.forEach((k) => root.style.removeProperty(k));

  // Apply overrides for the current mode
  const overrides = theme.forceDark ? theme.dark : theme.light;
  Object.entries(overrides).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
