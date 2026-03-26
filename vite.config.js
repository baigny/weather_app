import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      // Avoid CORS: browser calls same-origin, Vite forwards to IslamiCloud
      '/api/islamicloud': {
        target: 'https://api.islamicloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/islamicloud/, ''),
      },
    },
  },
})