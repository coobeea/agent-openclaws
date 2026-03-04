<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { settingsApi, imageApi } from '@/api'

const app = useAppStore()

const config = ref<Record<string, string>>({})
const loading = ref(true)
const saving = ref(false)
const saved = ref(false)

const imageStatus = ref<{ exists: boolean; id?: string; size?: string; created?: string; dockerRunning?: boolean } | null>(null)
const building = ref(false)
const buildLog = ref('')

onMounted(async () => {
  try {
    config.value = (await settingsApi.getAll()) as Record<string, string>
  } catch { /* use defaults */ }
  loading.value = false
  checkImage()
})

async function saveConfig() {
  saving.value = true
  try {
    await settingsApi.setBatch(config.value)
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
  } catch { /* graceful */ }
  finally { saving.value = false }
}

async function checkImage() {
  try {
    imageStatus.value = (await imageApi.status()) as typeof imageStatus.value
  } catch { imageStatus.value = null }
}

async function buildImage() {
  building.value = true
  buildLog.value = '正在构建镜像，请稍候...\n'
  try {
    const result = (await imageApi.build()) as { ok: boolean; message?: string }
    buildLog.value += result.ok ? '构建完成！\n' : `构建失败: ${result.message}\n`
    await checkImage()
  } catch (e: any) {
    buildLog.value += `错误: ${e.message}\n`
  } finally {
    building.value = false
  }
}

const fields = [
  { section: 'Gitea 配置', icon: 'i-carbon-logo-github', items: [
    { key: 'gitea.url', label: 'Gitea 地址', placeholder: 'http://localhost:13000' },
    { key: 'gitea.token', label: 'API Token', placeholder: '在 Gitea 用户设置中创建', type: 'password' },
  ]},
  { section: 'Docker 配置', icon: 'i-carbon-container-software', items: [
    { key: 'docker.workerImage', label: 'OpenClaw 镜像', placeholder: 'openclaw:local' },
    { key: 'docker.maxWorkers', label: '最大 Worker 数量', placeholder: '10', type: 'number' },
    { key: 'docker.network', label: 'Docker Network', placeholder: 'openclaws-net' },
  ]},
  { section: 'OpenClaw 配置', icon: 'i-carbon-network-4', items: [
    { key: 'openclaw.sourcePath', label: 'OpenClaw 源码路径', placeholder: '/path/to/openclaw' },
    { key: 'openclaw.workspaceBase', label: '工作区根目录', placeholder: '/path/to/workspaces' },
    { key: 'openclaw.gatewayPortBase', label: 'Gateway 端口基数', placeholder: '18800', type: 'number' },
    { key: 'openclaw.gatewayToken', label: 'Gateway Token', placeholder: '留空自动生成', type: 'password' },
  ]},
]
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

    <div v-if="loading" class="text-center py-20 text-muted-foreground">
      <span class="i-svg-spinners-ring-resize text-2xl" />
    </div>

    <template v-else>
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

      <!-- Config sections -->
      <div v-for="section in fields" :key="section.section" class="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 class="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
          <span :class="section.icon" class="text-primary" /> {{ section.section }}
        </h2>
        <div class="space-y-3">
          <div v-for="item in section.items" :key="item.key">
            <label class="block text-xs text-muted-foreground mb-1">{{ item.label }}</label>
            <input
              :value="config[item.key] || ''"
              @input="config[item.key] = ($event.target as HTMLInputElement).value"
              :type="item.type || 'text'"
              :placeholder="item.placeholder"
              class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      <!-- Image Management -->
      <div class="bg-card border border-border rounded-xl p-5 mb-4">
        <h2 class="text-sm font-semibold mb-3 inline-flex items-center gap-1.5">
          <span class="i-carbon-cube text-primary" /> 镜像管理
        </h2>
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-sm">
              <span v-if="imageStatus?.dockerRunning === false" class="text-error inline-flex items-center gap-1">
                <span class="i-carbon-error" /> Docker 未运行
              </span>
              <span v-else-if="imageStatus?.exists" class="text-success inline-flex items-center gap-1">
                <span class="i-carbon-checkmark-filled" /> 镜像已就绪
              </span>
              <span v-else class="text-warning inline-flex items-center gap-1">
                <span class="i-carbon-warning" /> 镜像未构建
              </span>
            </p>
            <p v-if="imageStatus?.exists" class="text-xs text-muted-foreground mt-1">
              {{ imageStatus.id?.substring(0, 16) }} · {{ imageStatus.size }}
            </p>
          </div>
          <button
            class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 inline-flex items-center gap-1"
            :disabled="building || !config['openclaw.sourcePath']"
            @click="buildImage"
          >
            <span v-if="building" class="i-svg-spinners-ring-resize" />
            <span v-else class="i-carbon-build" />
            {{ building ? '构建中...' : '构建镜像' }}
          </button>
        </div>
        <p v-if="!config['openclaw.sourcePath']" class="text-xs text-muted-foreground">
          请先在上方填写 OpenClaw 源码路径
        </p>
        <div v-if="buildLog" class="mt-3 bg-input-background border border-input rounded-lg p-3 max-h-40 overflow-y-auto">
          <pre class="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{{ buildLog }}</pre>
        </div>
      </div>

      <button
        class="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
        :disabled="saving"
        @click="saveConfig"
      >
        {{ saving ? '保存中...' : '保存配置' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
