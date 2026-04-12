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
];

const THEME_STORAGE_KEY = "gymberget_color_theme";

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
