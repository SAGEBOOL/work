import { defineConfig } from 'vite'

// 纯静态站点，base 用相对路径，方便部署到任意子目录/静态托管
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { outDir: 'dist', emptyOutDir: true }
})
