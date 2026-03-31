import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'process', 'stream', 'util'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  define: {
    'global': 'globalThis',
    'process.env': '{}',
    'process.version': '"v18.0.0"',
    'process.versions.node': '"18.0.0"',
    'process.platform': '"browser"',
  },
  build: {
    target: 'esnext',
  },
  server: {
    port: 3000,
    proxy: {},
  },
})
