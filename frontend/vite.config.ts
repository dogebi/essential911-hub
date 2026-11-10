import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BASE_PATH lets the same build be published under a GitHub Pages subfolder.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig(({ mode }) => ({
  base,
  plugins: [react()],
  define: {
    __HUB_DATA_MODE__: JSON.stringify(mode === 'static' ? 'static' : 'api'),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_TARGET ?? 'http://127.0.0.1:8099',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 4173 },
}))
