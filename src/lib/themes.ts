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
    preview: { bg: "#0a0a0a", card: "#1a1a2e", accent: "#39ff14" },
    light: {
      "--primary": "120 100% 35%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "120 40% 90%",
      "--accent-foreground": "120 100% 20%",
      "--ring": "120 100% 35%",
    },
    dark: {
      "--primary": "120 100% 55%",
      "--primary-foreground": "0 0% 0%",
      "--accent": "120 30% 18%",
      "--accent-foreground": "120 100% 70%",
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
      "--primary": "199 89% 48%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "199 40% 90%",
      "--accent-foreground": "199 89% 30%",
      "--ring": "199 89% 48%",
    },
    dark: {
      "--primary": "199 89% 60%",
      "--primary-foreground": "0 0% 0%",
      "--accent": "199 30% 18%",
      "--accent-foreground": "199 89% 70%",
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
      "--primary": "0 72% 50%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "0 40% 92%",
      "--accent-foreground": "0 72% 35%",
      "--ring": "0 72% 50%",
    },
    dark: {
      "--primary": "0 72% 55%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "0 30% 18%",
      "--accent-foreground": "0 72% 70%",
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
      "--primary": "43 96% 56%",
      "--primary-foreground": "0 0% 0%",
      "--accent": "43 50% 90%",
      "--accent-foreground": "43 96% 30%",
      "--ring": "43 96% 56%",
    },
    dark: {
      "--primary": "43 96% 56%",
      "--primary-foreground": "0 0% 0%",
      "--accent": "43 30% 18%",
      "--accent-foreground": "43 96% 70%",
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
      "--primary": "270 91% 65%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "270 40% 92%",
      "--accent-foreground": "270 91% 40%",
      "--ring": "270 91% 65%",
    },
    dark: {
      "--primary": "270 91% 65%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "270 30% 18%",
      "--accent-foreground": "270 91% 75%",
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

  // Remove previous theme overrides
  const root = document.documentElement;
  THEMES.forEach((t) => {
    Object.keys(t.light).forEach((k) => root.style.removeProperty(k));
    Object.keys(t.dark).forEach((k) => root.style.removeProperty(k));
  });

  // Apply new overrides
  Object.entries(overrides).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
