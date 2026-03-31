import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'process', 'path', 'stream', 'vm'],
      exclude: ['fs', 'fs/promises'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      'buffer': 'buffer/',
      'fs/promises': 'node-stdlib-browser/mock/empty',
      'fs': 'node-stdlib-browser/mock/empty',
    },
  },
  define: {
    'global': 'globalThis',
    'process.env': {},
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: ['fs', 'fs/promises'],
    },
  },
  optimizeDeps: {
    include: ['buffer', '@midnight-ntwrk/compact-runtime'],
    esbuildOptions: {
      target: 'esnext',
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
