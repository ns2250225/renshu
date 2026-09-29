// 将 MediaPipe 的 wasm 运行时复制到 public/，保证完全离线运行（onnxruntime 的 wasm 由 Vite 直接打包）
import { cpSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const jobs = [
  {
    from: 'node_modules/@mediapipe/tasks-vision/wasm',
    to: 'public/wasm/mediapipe',
    files: [
      'vision_wasm_internal.js',
      'vision_wasm_internal.wasm',
      'vision_wasm_nosimd_internal.js',
      'vision_wasm_nosimd_internal.wasm',
    ],
  },
]

for (const job of jobs) {
  mkdirSync(resolve(root, job.to), { recursive: true })
  for (const f of job.files) {
    const src = resolve(root, job.from, f)
    if (!existsSync(src)) {
      console.warn(`[copy-wasm] 缺少文件: ${src}`)
      continue
    }
    cpSync(src, resolve(root, job.to, f))
  }
}
console.log('[copy-wasm] wasm 运行时已复制到 public/wasm')
