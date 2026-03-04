<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()

const config = ref({
  gitea_url: 'http://localhost:13000',
  gitea_token: '',
  openclaw_gateway_port: 7860,
  max_workers: 10,
  worker_image: 'openclaws-worker:latest',
})

const saved = ref(false)

function saveConfig() {
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}
</script>

<template>
  <div class="max-w-2xl">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">设置</h1>
        <p class="text-sm text-muted-foreground mt-1">配置系统参数</p>
      </div>
      <transition name="fade">
        <span v-if="saved" class="text-xs text-success inline-flex items-center gap-1">
          <span class="i-carbon-checkmark-filled" /> 已保存
        </span>
      </transition>
    </div>

    <!-- Theme -->
    <div class="bg-card border border-border rounded-xl p-5 mb-4">
      <h2 class="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
        <span class="i-carbon-paint-brush text-primary" /> 外观
      </h2>
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted-foreground">暗色模式</span>
        <button
          class="w-12 h-6 rounded-full transition-colors relative"
          :class="app.darkMode ? 'bg-primary' : 'bg-muted'"
          @click="app.toggleDark"
        >
          <span
            class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
            :class="app.darkMode ? 'translate-x-6' : 'translate-x-0.5'"
          />
        </button>
      </div>
    </div>

    <!-- Gitea -->
    <div class="bg-card border border-border rounded-xl p-5 mb-4">
      <h2 class="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
        <span class="i-carbon-logo-github text-primary" /> Gitea 配置
      </h2>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-muted-foreground mb-1">Gitea 地址</label>
          <input v-model="config.gitea_url" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1">API Token</label>
          <input v-model="config.gitea_token" type="password" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="在 Gitea 用户设置中创建" />
        </div>
      </div>
    </div>

    <!-- Docker -->
    <div class="bg-card border border-border rounded-xl p-5 mb-4">
      <h2 class="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
        <span class="i-carbon-container-software text-primary" /> Docker 配置
      </h2>
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-muted-foreground mb-1">Worker 镜像</label>
          <input v-model="config.worker_image" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1">最大 Worker 数量</label>
          <input v-model.number="config.max_workers" type="number" min="1" max="50" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>
    </div>

    <!-- OpenClaw -->
    <div class="bg-card border border-border rounded-xl p-5 mb-4">
      <h2 class="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
        <span class="i-carbon-network-4 text-primary" /> OpenClaw 配置
      </h2>
      <div>
        <label class="block text-xs text-muted-foreground mb-1">主智能体 Gateway 端口</label>
        <input v-model.number="config.openclaw_gateway_port" type="number" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
    </div>

    <button
      class="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
      @click="saveConfig"
    >
      保存配置
    </button>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
