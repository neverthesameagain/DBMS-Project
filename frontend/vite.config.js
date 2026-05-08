import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // SPA fallback: redirect all non-file requests to index.html
    // This prevents 404s when refreshing on client-side routes like /groups/5
    historyApiFallback: true,
    // Same-origin /api in dev so the browser sends Authorization reliably (no cross-origin CORS quirks).
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
  // Ensure the build also handles SPA routing properly
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
