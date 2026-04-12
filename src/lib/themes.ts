export interface ThemeDefinition {
  id: string;
  name: string;
  emoji: string;
  preview: { bg: string; card: string; accent: string };
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "default",
    name: "Standard",
    emoji: "⬛",
    preview: { bg: "#ffffff", card: "#ffffff", accent: "#000000" },
    light: {},
    dark: {},
  },
  {
    id: "neon",
    name: "Neon",
    emoji: "💚",
    preview: { bg: "#0a0f0a", card: "#0f1a0f", accent: "#39ff14" },
    light: {
      "--background": "120 20% 97%",
      "--card": "120 15% 95%",
      "--card-foreground": "120 30% 10%",
      "--popover": "120 15% 95%",
      "--secondary": "120 15% 92%",
      "--muted": "120 10% 92%",
      "--accent": "120 40% 90%",
      "--accent-foreground": "120 100% 20%",
      "--primary": "120 100% 35%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "120 100% 35%",
    },
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
    preview: { bg: "#0c1929", card: "#132f4c", accent: "#29b6f6" },
    light: {
      "--background": "199 30% 97%",
      "--card": "199 25% 95%",
      "--card-foreground": "199 40% 10%",
      "--popover": "199 25% 95%",
      "--secondary": "199 20% 92%",
      "--muted": "199 15% 92%",
      "--accent": "199 40% 90%",
      "--accent-foreground": "199 89% 30%",
      "--primary": "199 89% 48%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "199 89% 48%",
    },
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
    preview: { bg: "#1a0a0a", card: "#2d1111", accent: "#dc2626" },
    light: {
      "--background": "0 25% 97%",
      "--card": "0 20% 95%",
      "--card-foreground": "0 30% 10%",
      "--popover": "0 20% 95%",
      "--secondary": "0 15% 92%",
      "--muted": "0 10% 92%",
      "--accent": "0 40% 92%",
      "--accent-foreground": "0 72% 35%",
      "--primary": "0 72% 50%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "0 72% 50%",
    },
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
    preview: { bg: "#1a1508", card: "#2d2510", accent: "#fbbf24" },
    light: {
      "--background": "43 30% 97%",
      "--card": "43 25% 94%",
      "--card-foreground": "43 40% 10%",
      "--popover": "43 25% 94%",
      "--secondary": "43 20% 91%",
      "--muted": "43 15% 91%",
      "--accent": "43 50% 90%",
      "--accent-foreground": "43 96% 30%",
      "--primary": "43 96% 56%",
      "--primary-foreground": "0 0% 0%",
      "--ring": "43 96% 56%",
    },
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
    preview: { bg: "#150a2e", card: "#1e1145", accent: "#a855f7" },
    light: {
      "--background": "270 25% 97%",
      "--card": "270 20% 95%",
      "--card-foreground": "270 30% 10%",
      "--popover": "270 20% 95%",
      "--secondary": "270 15% 92%",
      "--muted": "270 10% 92%",
      "--accent": "270 40% 92%",
      "--accent-foreground": "270 91% 40%",
      "--primary": "270 91% 65%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "270 91% 65%",
    },
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

  const isDark = document.documentElement.classList.contains("dark");
  const overrides = isDark ? theme.dark : theme.light;

  // Collect all possible CSS variable keys across all themes
  const allKeys = new Set<string>();
  THEMES.forEach((t) => {
    Object.keys(t.light).forEach((k) => allKeys.add(k));
    Object.keys(t.dark).forEach((k) => allKeys.add(k));
  });

  // Remove all previous theme overrides
  const root = document.documentElement;
  allKeys.forEach((k) => root.style.removeProperty(k));

  // Apply new overrides
  Object.entries(overrides).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
