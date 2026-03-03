import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const token = Buffer.from('admin:cCm0X0EUPAFlak/w').toString('base64')
            proxyReq.setHeader('Authorization', `Basic ${token}`)
          })
        },
      },
    },
  },
  build: {
    outDir: '../public/dist',
  },
})
