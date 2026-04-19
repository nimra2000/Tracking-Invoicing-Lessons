import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Forward Base44 API calls to the local dev server (base44 dev on :4400).
    // Same-origin for the browser, so cookies and auth flows work cleanly.
    proxy: {
      "/api": {
        target: "http://localhost:4400",
        changeOrigin: true,
        cookieDomainRewrite: "",
        cookiePathRewrite: "/",
      },
      "/auth": {
        target: "http://localhost:4400",
        changeOrigin: true,
        cookieDomainRewrite: "",
        cookiePathRewrite: "/",
      },
    },
  },
});
