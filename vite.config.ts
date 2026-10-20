import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serviert das Repo unter /<repo-name>/
const base = process.env.BASE_PATH ?? '/MoLog/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'icon.svg'],
      manifest: {
        name: 'MoLog',
        short_name: 'MoLog',
        description: 'Minimalistischer Gym-Tracker',
        lang: 'de',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e0f11',
        theme_color: '#0e0f11',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
