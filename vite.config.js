import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
        globPatterns: ["**/*.{js,css,html,png,svg}"],
      },
    }),
  ],
});
