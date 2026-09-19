import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: { sourcemap: false }
  },
  preload: {
    build: { externalizeDeps: false, sourcemap: false }
  },
  renderer: {
    build: { sourcemap: false },
    plugins: [react(), tailwindcss()]
  }
})
