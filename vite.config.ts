import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base: nome do repositório, para funcionar no GitHub Pages
// (https://lcoelholk.github.io/Contas-casa/)
export default defineConfig({
  base: '/Contas-casa/',
  plugins: [
    react(),
    tailwindcss(),
    // Instalável no celular ("Adicionar à tela inicial") e abre rápido sem rede.
    // Os dados (Supabase) nunca ficam em cache: só os arquivos do app.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Contas da Casa',
        short_name: 'Contas',
        description: 'Finanças do Lucas e da Emillia',
        lang: 'pt-BR',
        start_url: '/Contas-casa/',
        scope: '/Contas-casa/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0f766e',
        background_color: '#fafaf9',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    // ~150 kB compactado: aceitável para o app inteiro
    chunkSizeWarningLimit: 800,
  },
})
