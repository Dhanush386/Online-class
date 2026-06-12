import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/',
  build: {
    outDir: 'dist',
    // Split vendor libraries into separate cached chunks
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — rarely changes, cached aggressively
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Supabase — large SDK, separate chunk
          'supabase': ['@supabase/supabase-js'],
          // Charts — only needed on dashboard/analytics pages
          'charts': ['recharts'],
          // Face API — very large, only needed on profile/student management
          'face-api': ['@vladmandic/face-api'],
          // Code editor and player — needed only in coding/course pages
          'media': ['react-player', 'html2canvas'],
          // Icon library
          'icons': ['lucide-react'],
        }
      }
    }
  }
})
