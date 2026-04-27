import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/scheduler": {
        target: "https://script.google.com",
        changeOrigin: true,
        secure: true,
        rewrite: () =>
          "/macros/s/AKfycbxJBgfF1oH1qNR0NYayCqdC4D1gHvxZtZQqzTcKLgIVJE2yZBkMvSB69ThRTPUVG88qfA/exec",
      },
    },
  },
});