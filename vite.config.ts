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
    }),
  ],
  build: {
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
        },
      },
    },
    // Performance hints
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging
    sourcemap: false,
    // Minification
    minify: 'esbuild',
  },
  // Optimize deps
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})
