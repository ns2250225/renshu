import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// COOP/COEP 让 onnxruntime-web 可以启用多线程 wasm
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  base: './',
  plugins: [vue()],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
})
