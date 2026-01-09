import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiUrl = process.env.VITE_API_URL || 'http://127.0.0.1:5000'
const wsUrl = process.env.VITE_WS_URL || 'ws://127.0.0.1:8765'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5001,
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
      },
      '/ws': {
        target: wsUrl,
        ws: true,
      },
      '/npl-time': {
        target: 'https://www.nplindia.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/npl-time/, '/cgi-bin/ntp_client'),
        secure: true,
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    css: true,
  }
})
