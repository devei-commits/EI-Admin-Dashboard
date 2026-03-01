import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Bundle analyzer - generates stats.html after build
    visualizer({
      filename: 'stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }) as any,
  ],
  build: {
    // Target modern browsers for smaller bundles
    target: 'esnext',
    // Code splitting configuration
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core libraries
          if (id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router-dom/')) {
            return 'react-vendor';
          }
          // Radix UI components
          if (id.includes('node_modules/@radix-ui/')) {
            return 'ui-vendor';
          }
          // TanStack libraries
          if (id.includes('node_modules/@tanstack/')) {
            return 'query-vendor';
          }
          // Chart libraries
          if (id.includes('node_modules/recharts/')) {
            return 'chart-vendor';
          }
          // Export utilities
          if (id.includes('node_modules/xlsx/') || id.includes('node_modules/file-saver/')) {
            return 'utils-vendor';
          }
          // Lucide icons - separate chunk to reduce main bundle
          if (id.includes('node_modules/lucide-react/')) {
            return 'icons-vendor';
          }
          // Date utilities
          if (id.includes('node_modules/date-fns/')) {
            return 'date-vendor';
          }
        },
      },
    },
    // Performance hints
    chunkSizeWarningLimit: 1000,
    // Disable source maps for smaller production bundles
    sourcemap: false,
    // Minification with esbuild (faster than terser)
    minify: 'esbuild',
    // Skip compressed size reporting for faster builds
    reportCompressedSize: false,
    // CSS code splitting
    cssCodeSplit: true,
  },
  // Optimize deps for faster dev server startup
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'lucide-react', 'sonner'],
  },
  // Dev server: proxy API to backend (backend on port 3000)
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://ei-website-backend-production.up.railway.app/',
        //target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
    warmup: {
      clientFiles: ['./src/App.tsx', './src/main.tsx'],
    },
  },
})
