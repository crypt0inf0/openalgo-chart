import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@context': path.resolve(__dirname, './src/context'),
    },
  },
  server: {
    port: 5001,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8765',
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
