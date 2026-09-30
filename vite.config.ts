import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: nome do repositório, para funcionar no GitHub Pages
// (https://lcoelholk.github.io/Contas-casa/)
export default defineConfig({
  base: '/Contas-casa/',
  plugins: [react(), tailwindcss()],
})
