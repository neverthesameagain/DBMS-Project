import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // SPA fallback: redirect all non-file requests to index.html
    // This prevents 404s when refreshing on client-side routes like /groups/5
    historyApiFallback: true,
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
