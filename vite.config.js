import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the app from /<repo>/, so assets need that prefix.
// Vercel serves from the domain root and needs '/', which stays the default.
export default defineConfig({
  base: process.env.GH_PAGES ? '/Datadrop/' : '/',
  plugins: [react()],
  build: {
    // The chart libraries are the bulk of the bundle and none of them are
    // needed to paint the landing state, so split them out.
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts', 'd3'],
          sheets: ['xlsx', 'papaparse'],
          capture: ['html2canvas'],
        },
      },
    },
  },
})
