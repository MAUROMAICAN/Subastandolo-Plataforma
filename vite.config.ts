import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
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
      registerType: "autoUpdate",
      injectRegister: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,png,svg,webp,woff2}"],
        globIgnores: ["**/favicon.ico", "**/sounds/**"],
        cleanupOutdatedCaches: true,
        importScripts: ["/push-handler.js"],
        // ALWAYS fetch HTML (index.html) from the network so users see the latest version
        navigateFallback: null,
        runtimeCaching: [
          {
            // Navigation requests: always network-first so JS & CSS updates are picked up
            urlPattern: ({ request }: { request: Request }) => request.mode === "navigate",
            handler: "NetworkFirst" as const,
            options: {
              cacheName: "pages-cache",
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst" as const,
            options: {
              cacheName: "supabase-images",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: "CacheFirst" as const,
            options: {
              cacheName: "static-images",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ["favicon.png", "icons/*.png", "push-handler.js"],
      manifest: {
        name: "SUBASTANDOLO",
        short_name: "SUBASTANDOLO",
        description: "Plataforma de subastas online SUBASTANDOLO",
        theme_color: "#1a1a2e",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "es",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Force single React instance to prevent white screen from duplicate dispatchers
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["@tanstack/react-query"],
  },
}));
