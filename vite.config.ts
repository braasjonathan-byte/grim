import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import legacy from "@vitejs/plugin-legacy";

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
  build: {
    target: ["es2020", "safari14", "chrome87", "firefox78", "edge88"],
    cssTarget: ["safari11", "chrome64"],
    rollupOptions: {
      output: {
        // Stora tredjepartsbibliotek i egna chunks (åtgärd 24) så att de cachas
        // separat och inte följer med i Index/WorkoutView-chunkarna.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return "vendor-recharts";
          if (/[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/.test(id)) return "vendor-leaflet";
          if (/[\\/]node_modules[\\/]@capacitor[\\/]/.test(id)) return "vendor-capacitor";
          if (/[\\/]node_modules[\\/]date-fns[\\/]/.test(id)) return "vendor-date-fns";
          if (/[\\/]node_modules[\\/]@dnd-kit[\\/]/.test(id)) return "vendor-dnd-kit";
          if (/[\\/]node_modules[\\/]qrcode\.react[\\/]/.test(id)) return "vendor-qrcode";
          return undefined;
        },
      },
    },
  },
  esbuild: {
    supported: {
      bigint: true,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    versionJsonPlugin(),
    // The MCP edge function is maintained directly; codegen refuses to
    // overwrite it and would strip its required Deno type annotations.
    // Generate a legacy bundle (ES5 + polyfills) for older phones
    // Covers iOS 11+, Android 5+ Chrome, Samsung Internet 7+, etc.
    legacy({
      targets: [
        "defaults",
        "iOS >= 11",
        "Safari >= 11",
        "Android >= 5",
        "Chrome >= 64",
        "Firefox >= 60",
        "Samsung >= 7",
        "not dead",
      ],
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "public",
      filename: "custom-sw.js",
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      includeAssets: ["favicon.ico", "robots.txt"],
      // Build SW as a classic script (not ES module) so it works in older
      // WebViews / Safari < 15.4 when the app is installed to home screen.
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Legacy-bundles (bara för gamla webbläsare) och stora bilder hämtas vid behov
        // i stället för att laddas ner i bakgrunden vid första besöket.
        globIgnores: [
          "**/version.json",
          "**/*-legacy-*.js",
          "**/polyfills-legacy-*.js",
          "lovable-uploads/**",
          "recipes/**",
          "grim-logo-hires.png",
          "grim-logo-vector.png",
          "android-icons-source/**",
        ],
        rollupFormat: "iife",
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
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/grim-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
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
