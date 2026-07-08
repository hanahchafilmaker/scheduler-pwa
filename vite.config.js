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
      // ✨ 'auto' 설정 덕분에 Vite가 빌드 시 HTML에 서비스 워커 등록 스크립트를 알아서 심어줍니다.
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

  // ✨ 프로덕션 빌드 시 브라우저 콘솔의 console.log 및 debugger 구문을 자동으로 삭제합니다 (보안 조치).
  esbuild: {
    drop: ["console", "debugger"],
  },

  build: {
    outDir: "dist",
    emptyOutDir: true,
    // ✨ 800kB 대의 외부 라이브러리(vendor) 뭉치 때문에 뜨던 노란색 용량 경고창을 안 뜨게 숨겨줍니다.
    chunkSizeWarningLimit: 1500, 
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        staff: path.resolve(__dirname, "staff.html"),
        qc: path.resolve(__dirname, "qc.html"),
      },
      output: {
        manualChunks(id) {
          // React 계열 핵심 라이브러리 분리
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          // Supabase 데이터베이스 라이브러리 분리
          if (id.includes("node_modules/@supabase/")) {
            return "supabase-vendor";
          }

          // 그 외 대형 외부 모듈들
          if (id.includes("node_modules/")) {
            return "vendor";
          }
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