import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
// Auto-increment patch version: days since 2026-02-27 → 1.0.2 on Mar 1, 1.0.3 on Mar 2, etc.
const patchNumber = Math.floor((Date.now() - new Date("2026-02-27T00:00:00Z").getTime()) / 86_400_000);
const appVersion = `1.0.${patchNumber}`;

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "public",
      filename: "custom-sw.js",
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "robots.txt"],
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
      },
      manifest: {
        name: "Grim – Träningsapp",
        short_name: "Grim",
        description: "Spåra träning, följ vänner, beräkna 1RM och pulszoner.",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          {
            src: "/grim-icon.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/grim-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
