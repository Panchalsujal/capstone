import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.brohsop.in',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',   // rewrite cookie domain so browser keeps it
      }
    }
  }
})
