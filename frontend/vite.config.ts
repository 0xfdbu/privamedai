import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'process', 'stream'],
    }),
  ],
  define: {
    'global': 'globalThis',
    'process.env': '{}',
  },
  build: {
    target: 'esnext',
  },
  server: {
    port: 3000,
    // Don't proxy WebSocket - let wallet connect directly to Midnight network
    proxy: {},
  },
})
