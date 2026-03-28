import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Local backend by default so Client/Vendor Master matches your DB when developing
  // Override: VITE_DEV_API_PROXY=https://your-deployed-api.example/ npm run dev
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget =
    env.VITE_DEV_API_PROXY?.trim() || "http://127.0.0.1:3000";

  return {
  plugins: [react(), tailwindcss()],
  build: {
    // Target modern browsers for smaller bundle
    target: "esnext",
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core libraries
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/")
          ) {
            return "react-vendor";
          }
          // Radix UI components
          if (id.includes("node_modules/@radix-ui/")) {
            return "ui-vendor";
          }
          // TanStack libraries
          if (id.includes("node_modules/@tanstack/")) {
            return "query-vendor";
          }
          // Chart libraries
          if (id.includes("node_modules/recharts/")) {
            return "chart-vendor";
          }
          // Export utilities
          if (
            id.includes("node_modules/xlsx/") ||
            id.includes("node_modules/file-saver/")
          ) {
            return "utils-vendor";
          }
          // Lucide icons - separate chunk to reduce main bundle
          if (id.includes("node_modules/lucide-react/")) {
            return "icons-vendor";
          }
          // Date utilities
          if (id.includes("node_modules/date-fns/")) {
            return "date-vendor";
          }
        },
      },
    },
    // Performance hints
    chunkSizeWarningLimit: 1000,
    // Disable source maps for smaller production bundles
    sourcemap: false,
    // Minification with esbuild (faster than terser)
    minify: "esbuild",
    // Skip compressed size reporting for faster builds
    reportCompressedSize: false,
    // CSS code splitting
    cssCodeSplit: true,
  },
  // Optimize deps for faster dev server startup
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "lucide-react",
      "sonner",
    ],
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
    warmup: {
      clientFiles: ["./src/App.tsx", "./src/main.tsx"],
    },
  },
  };
});
