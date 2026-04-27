import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
  base: isProd ? "/scheduler-pwa/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "스마트 스케줄러",
        short_name: "스케줄러",
        description: "관리자 대시보드 및 자동 스케줄링 앱",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      "/api/scheduler": {
        target: "https://script.google.com",
        changeOrigin: true,
        secure: true,
        rewrite: () =>
          "/macros/s/AKfycbxJBgfF1oH1qNR0NYayCqdC4D1gHvxZtZQqzTcKLgIVJE2yZBkMvSB69ThRTPUVG88qfA/exec",
      }
    }
  }
});