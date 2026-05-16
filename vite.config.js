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

  // ✨ 프로덕션 빌드 시 console.log 및 debugger 구문을 자동으로 삭제합니다.
  esbuild: {
    drop: ["console", "debugger"],
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
          // 1. React 계열 핵심 라이브러리 분리 (기존 유지)
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          // 2. Supabase 데이터베이스 라이브러리 분리 (기존 유지)
          if (id.includes("node_modules/@supabase/")) {
            return "supabase-vendor";
          }

          // 3. ✨ UI / 아이콘 / 애니메이션 라이브러리 추가 분리
          // 프로젝트에서 많이 쓰이는 무거운 UI 패키지들을 ui-vendor로 묶어 쪼갭니다.
          if (
            id.includes("node_modules/lucide-react/") ||
            id.includes("node_modules/@radix-ui/") ||
            id.includes("node_modules/framer-motion/") ||
            id.includes("node_modules/recharts/") // 만약 차트를 쓰신다면 포함
          ) {
            return "ui-vendor";
          }

          // 4. ✨ 날짜 및 대형 유틸리티 라이브러리 추가 분리
          if (
            id.includes("node_modules/date-fns/") ||
            id.includes("node_modules/lodash/") ||
            id.includes("node_modules/axios/")
          ) {
            return "util-vendor";
          }

          // 5. 나머지 잔잔한 외부 모듈들 (기존 유지)
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