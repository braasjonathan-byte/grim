import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
// Unique app version per build so mobile/PWA clients can detect updates immediately
const appVersion = new Date().toISOString();

// Plugin: emit a /version.json file the client can poll to detect new deploys.
const versionJsonPlugin = () => ({
  name: "emit-version-json",
  configureServer(server: any) {
    server.middlewares.use("/version.json", (_req: any, res: any) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.end(JSON.stringify({ version: appVersion }));
    });
  },
  generateBundle() {
    (this as any).emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ version: appVersion }),
    });
  },
});

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
    versionJsonPlugin(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "public",
      filename: "custom-sw.js",
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      includeAssets: ["favicon.ico", "robots.txt"],
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Never precache version.json — it must always be fetched fresh.
        globIgnores: ["**/version.json"],
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
