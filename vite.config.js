import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAS_PATH =
  "/macros/s/AKfycbyHU9b2OEeLMY9z9S94M7XWhfOYV7AwmZ8DHTzeBDspD3dGnf9GT2xCRzCaAQGTZ342zQ/exec";

export default defineConfig({
  base: "/",

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html}"],
      },
      includeAssets: ["icons.jpg"],
      manifest: {
        name: "스마트 스케줄러",
        short_name: "스케줄러",
        description: "관리자 대시보드 및 직원 출퇴근 앱",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "icons.jpg",
            sizes: "192x192",
            type: "image/jpeg",
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        staff: path.resolve(__dirname, "staff.html"),
      },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react")) return "react-vendor";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },

  server: {
    proxy: {
      "/api/scheduler": {
        target: "https://script.google.com",
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: (urlPath) =>
          urlPath.replace(/^\/api\/scheduler/, GAS_PATH),
      },
      "/api/staff": {
        target: "https://script.google.com",
        changeOrigin: true,
        secure: true,
        followRedirects: true,
        rewrite: (urlPath) =>
          urlPath.replace(/^\/api\/staff/, GAS_PATH),
      },
    },
  },
});