import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
 
// KrishiMitra AI - Vite Config with API Proxy
// Groq aur Weather dono ke liye proxy — CORS issue fix hoga
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Groq AI API proxy
      '/api/groq': {
        target: 'https://api.groq.com',
        changeOrigin: true,
        rewrite: (path) => '/openai/v1/chat/completions',
        headers: {
          'Authorization': '',
        },
      },
      // Weather API proxy
      '/api/weather': {
        target: 'https://api.openweathermap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/weather', '/data/2.5'),
      },
    },
  },
})
 
