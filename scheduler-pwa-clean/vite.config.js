import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const GAS_PATH =
  "/macros/s/AKfycbwNkyY9klWD0nDlTtl4xjFjG1z1MVp8uoWa9LEPvkhcoR7VZu8Kk7asDlxYOaOcW8MLkA/exec";

export default defineConfig({
  base: "/",

  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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