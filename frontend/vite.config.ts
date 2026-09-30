import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['gladly-stardust-second.ngrok-free.dev'],
    port: 5173,
  },
})
