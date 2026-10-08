import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Build stamp shown on the welcome screen so anyone can tell exactly which
// version of the app they are looking at (and spot a stale cached copy).
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));
let sha = (process.env.COMMIT_REF || "").slice(0, 7);
if (!sha) {
  try {
    sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch (e) {
    sha = "local";
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_SHA__: JSON.stringify(sha),
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        entryFileNames: "assets/app-[hash].js",
        chunkFileNames: "assets/chunk-[name]-[hash].js",
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png", "icon-maskable-512.png"],
      manifest: {
        name: "SEMAI — AI Lecturer",
        short_name: "SEMAI",
        description: "AI-led live lectures built from your own course materials.",
        theme_color: "#14181C",
        background_color: "#14181C",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell caches for offline install; AI/voice/DB calls always
        // need a live network connection regardless, so there's no
        // meaningful "offline lecture" mode — this just makes the app
        // itself load instantly and be installable.
        //
        // Only the app shell is precached. The heavy lazy chunks (Mermaid's
        // diagram engines, mathjs, jsPDF…) are named "chunk-*" and are cached
        // the first time they're actually used, so installing the app stays
        // light but diagrams/maths still work offline after first use.
        globPatterns: ["index.html", "assets/app-*.js", "assets/*.css", "*.{png,svg,ico}"],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst", // file names are content-hashed, so cache-first is safe
            options: { cacheName: "semai-lazy-assets", expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
});
