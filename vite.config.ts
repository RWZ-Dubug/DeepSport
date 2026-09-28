import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    watch: {
      // 忽略编辑器/工具保存时产生的临时文件。
      // 不忽略的话，文件监听器会去监视这些瞬间消失的临时目录，撞上 EBUSY 直接崩掉。
      ignored: ['**/*.tmpdir/**', '**/.*.tmpdir/**', '**/*.tmp'],
    },
  },
})
