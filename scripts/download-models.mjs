// 下载识别模型到 public/models（已存在则跳过）
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dir = resolve(root, 'public/models')
mkdirSync(dir, { recursive: true })

const models = [
  {
    file: 'yolox_nano.onnx',
    urls: [
      'https://raw.githubusercontent.com/Kazuhito00/NARUTO-HandSignDetection/main/model/yolox/yolox_nano.onnx',
      'https://ghfast.top/https://raw.githubusercontent.com/Kazuhito00/NARUTO-HandSignDetection/main/model/yolox/yolox_nano.onnx',
    ],
  },
  {
    file: 'hand_landmarker.task',
    urls: [
      'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
    ],
  },
]

for (const m of models) {
  const target = resolve(dir, m.file)
  if (existsSync(target)) {
    console.log(`[models] 已存在 ${m.file}`)
    continue
  }
  let ok = false
  for (const url of m.urls) {
    try {
      console.log(`[models] 下载 ${url}`)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      writeFileSync(target, Buffer.from(await res.arrayBuffer()))
      ok = true
      break
    } catch (e) {
      console.warn(`[models] 失败: ${e.message}`)
    }
  }
  if (!ok) console.error(`[models] 无法下载 ${m.file}，请手动放到 public/models/`)
}
