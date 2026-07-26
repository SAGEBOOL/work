import { defineConfig } from 'vite'

// 纯静态站点，base 用相对路径，方便部署到任意子目录/静态托管
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  // ffmpeg.wasm 内部用 Worker + import.meta.url，需排除预打包并保留 ES worker
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  worker: { format: 'es' },
  build: { outDir: 'dist', emptyOutDir: true }
})
