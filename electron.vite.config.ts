import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ['dockerode', 'tar-fs', 'cpu-features', 'ssh2', 'ws', 'bufferutil', 'utf-8-validate']
      }
    },
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [
      vue(),
      tailwindcss(),
      Components({
        resolvers: [IconsResolver({ prefix: 'icon' })]
      }),
      Icons({ compiler: 'vue3' })
    ]
  }
})
