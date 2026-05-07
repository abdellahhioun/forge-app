import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      lib: {
        entry: resolve('main/index.ts'),
      }
    },
    resolve: {
      alias: { '@shared': resolve('shared') }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: resolve('preload/index.ts'),
      }
    },
    resolve: {
      alias: { '@shared': resolve('shared') }
    }
  },
  renderer: {
    root: resolve('renderer'),
    define: {
      'process.env': '{}',
      'process.platform': JSON.stringify(process.platform),
    },
    build: {
      rollupOptions: {
        input: resolve('renderer/index.html'),
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('renderer/src'),
        '@shared': resolve('shared')
      }
    },
    plugins: [
      react(),
      tailwindcss()
    ]
  }
})
