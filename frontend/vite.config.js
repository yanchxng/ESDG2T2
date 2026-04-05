import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const kongTarget = process.env.VITE_KONG_PROXY_TARGET || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Same-origin requests to /kong/* → Kong (no browser CORS in dev)
    proxy: {
      '/kong': {
        target: kongTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/kong/, '') || '/',
      },
    },
  },
})
