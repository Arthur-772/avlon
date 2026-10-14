import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Vite 配置：渲染进程构建配置（优化启动速度）
export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',            // 使用 esbuild 压缩（内置，无需安装 terser）
    cssMinify: true,              // 压缩 CSS
    sourcemap: false,             // 不生成 sourceMap（减小体积）
    reportCompressedSize: false,  // 不报告压缩大小（加速构建）
    chunkSizeWarningLimit: 100,   // chunk 大小警告阈值
    rollupOptions: {
      output: {
        manualChunks: undefined,  // 禁用代码分割（单 chunk 加载更快）
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})