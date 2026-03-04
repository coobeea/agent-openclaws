<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { agentsApi, tasksApi, systemApi, imageApi } from '@/api'
import { getGatewayClient } from '@/services/GatewayClient'

interface Agent { id: number; name: string; role: string; status: string; health_ok: number; gateway_port: number | null }

const agents = ref<Agent[]>([])
const tasks = ref<any[]>([])
const dockerRunning = ref(false)
const imageReady = ref(false)
const loading = ref(true)

const gw = getGatewayClient()
const backendOk = gw.connected

const totalAgents = computed(() => agents.value.length)
const runningAgents = computed(() => agents.value.filter(a => a.status === 'running').length)
const healthyAgents = computed(() => agents.value.filter(a => a.health_ok).length)
const masterAgent = computed(() => agents.value.find(a => a.role === 'master'))

const totalTasks = computed(() => tasks.value.length)
const pendingTasks = computed(() => tasks.value.filter(t => t.status === 'pending').length)
const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress').length)
const completedTasks = computed(() => tasks.value.filter(t => t.status === 'completed').length)

async function loadData() {
  if (!backendOk.value) return
  
  try {
    const [agentsRes, tasksRes, imgRes] = await Promise.allSettled([
      agentsApi.list(),
      tasksApi.list(),
      imageApi.status(),
    ])

    if (agentsRes.status === 'fulfilled') agents.value = agentsRes.value as Agent[]
    if (tasksRes.status === 'fulfilled') tasks.value = tasksRes.value as any[]
    if (imgRes.status === 'fulfilled') {
      const imgData = imgRes.value as any
      dockerRunning.value = imgData?.dockerRunning !== false
      imageReady.value = imgData?.exists ?? false
    }
  } catch { /* ignore */ }
  loading.value = false
}

onMounted(() => {
  loadData()
  gw.on('agents.updated', (data: any) => {
    agents.value = data as Agent[]
  })
})

watch(backendOk, (ok) => {
  if (ok) {
    loading.value = true
    loadData()
  }
})

function openDashboard(agent: Agent) {
  if (agent.gateway_port) {
    const url = `http://localhost:${agent.gateway_port}/?token=${agent.gateway_token || ''}#token=${agent.gateway_token || ''}`
    window.open(url, '_blank')
  }
}
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}
</script>

<template>
  <div>
    <!-- Page Header with Enhanced Style -->
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center">
          <span class="i-carbon-dashboard text-2xl text-success"></span>
        </div>
        <div>
          <h1 class="text-2xl font-bold">仪表盘</h1>
          <p class="text-sm text-muted-foreground mt-0.5">龙虾军团运行总览</p>
        </div>
      </div>
      <div class="flex items-center gap-2.5">
        <span
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
          :class="!dockerRunning ? 'bg-error/15 text-error border border-error/20' : imageReady ? 'bg-success/15 text-success border border-success/20' : 'bg-warning/15 text-warning border border-warning/20'"
        >
          <span class="i-carbon-cube text-base" />
          {{ !dockerRunning ? 'Docker 未运行' : imageReady ? '镜像就绪' : '镜像未构建' }}
        </span>
        <span
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
          :class="backendOk ? 'bg-success/15 text-success border border-success/20' : 'bg-error/15 text-error border border-error/20'"
        >
          <span class="w-2 h-2 rounded-full" :class="backendOk ? 'bg-success animate-pulse' : 'bg-error'" />
          {{ backendOk ? 'Gateway 在线' : 'Gateway 离线' }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-32 text-muted-foreground">
      <div class="flex flex-col items-center gap-3">
        <span class="i-svg-spinners-ring-resize text-4xl text-primary" />
        <p class="text-sm">加载数据中...</p>
      </div>
    </div>

    <template v-else>
      <!-- Agent Stats with Enhanced Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-gradient-to-br from-card to-card/80 border border-border/50 rounded-2xl p-6 hover:shadow-lg transition-all group">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-medium text-muted-foreground">龙虾总数</p>
            <span class="i-carbon-bot text-xl text-primary/30 group-hover:text-primary/50 transition-colors"></span>
          </div>
          <p class="text-4xl font-bold text-primary">{{ totalAgents }}</p>
        </div>
        <div class="bg-gradient-to-br from-card to-card/80 border border-border/50 rounded-2xl p-6 hover:shadow-lg transition-all group">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-medium text-muted-foreground">运行中</p>
            <span class="i-carbon-play-filled text-xl text-success/30 group-hover:text-success/50 transition-colors"></span>
          </div>
          <p class="text-4xl font-bold text-success">{{ runningAgents }}</p>
        </div>
        <div class="bg-gradient-to-br from-card to-card/80 border border-border/50 rounded-2xl p-6 hover:shadow-lg transition-all group">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-medium text-muted-foreground">健康状态</p>
            <span class="i-carbon-health-cross text-xl transition-colors" :class="healthyAgents === runningAgents && runningAgents > 0 ? 'text-success/30 group-hover:text-success/50' : 'text-warning/30 group-hover:text-warning/50'"></span>
          </div>
          <p class="text-4xl font-bold" :class="healthyAgents === runningAgents && runningAgents > 0 ? 'text-success' : 'text-warning'">{{ healthyAgents }}</p>
        </div>
        <div class="bg-gradient-to-br from-card to-card/80 border border-border/50 rounded-2xl p-6 hover:shadow-lg transition-all group">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-medium text-muted-foreground">任务总数</p>
            <span class="i-carbon-task text-xl text-info/30 group-hover:text-info/50 transition-colors"></span>
          </div>
          <p class="text-4xl font-bold text-info">{{ totalTasks }}</p>
        </div>
      </div>

      <!-- Task Stats with Enhanced Cards -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20 rounded-2xl p-5 text-center hover:shadow-lg transition-all group">
          <div class="w-12 h-12 rounded-xl bg-warning/15 flex items-center justify-center mx-auto mb-3">
            <span class="i-carbon-pending text-2xl text-warning" />
          </div>
          <p class="text-3xl font-bold text-warning mb-1">{{ pendingTasks }}</p>
          <p class="text-xs font-medium text-warning/70">待处理任务</p>
        </div>
        <div class="bg-gradient-to-br from-info/10 to-info/5 border border-info/20 rounded-2xl p-5 text-center hover:shadow-lg transition-all group">
          <div class="w-12 h-12 rounded-xl bg-info/15 flex items-center justify-center mx-auto mb-3">
            <span class="i-carbon-in-progress text-2xl text-info" />
          </div>
          <p class="text-3xl font-bold text-info mb-1">{{ inProgressTasks }}</p>
          <p class="text-xs font-medium text-info/70">进行中任务</p>
        </div>
        <div class="bg-gradient-to-br from-success/10 to-success/5 border border-success/20 rounded-2xl p-5 text-center hover:shadow-lg transition-all group">
          <div class="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center mx-auto mb-3">
            <span class="i-carbon-checkmark-filled text-2xl text-success" />
          </div>
          <p class="text-3xl font-bold text-success mb-1">{{ completedTasks }}</p>
          <p class="text-xs font-medium text-success/70">已完成任务</p>
        </div>
      </div>

      <!-- Agent Fleet with Enhanced Style -->
      <div class="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
        <div class="flex items-center gap-2.5 mb-5 pb-3 border-b border-border/30">
          <span class="i-carbon-group text-xl text-primary"></span>
          <h2 class="text-lg font-bold">军团阵容</h2>
        </div>
        <div v-if="agents.length === 0" class="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div class="w-16 h-16 rounded-2xl bg-surface-variant/50 flex items-center justify-center mb-3">
            <span class="i-carbon-bot text-3xl opacity-30"></span>
          </div>
          <p class="text-sm font-medium mb-1">暂无龙虾</p>
          <p class="text-xs text-muted-foreground/70">前往智能体管理创建第一个龙虾</p>
        </div>
        <div v-else class="space-y-2.5">
          <div v-for="agent in agents" :key="agent.id" class="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-surface-variant/60 to-surface-variant/30 rounded-xl border border-border/30 hover:border-border hover:shadow-md transition-all group">
            <div class="flex items-center gap-3.5">
              <div 
                class="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                :class="agent.role === 'master' ? 'bg-gradient-to-br from-warning/15 to-warning/5 text-warning' : agent.role === 'qa' ? 'bg-gradient-to-br from-success/15 to-success/5 text-success' : 'bg-gradient-to-br from-info/15 to-info/5 text-info'"
              >
                <span :class="agent.role === 'master' ? 'i-carbon-crown-ambassador' : agent.role === 'qa' ? 'i-carbon-security' : 'i-carbon-bot'" class="text-xl" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm">{{ agent.name }}</span>
                  <span class="text-xs text-muted-foreground/60 font-mono">:{{ agent.gateway_port || '-' }}</span>
                </div>
                <div v-if="agent.status === 'running' && agent.gateway_port" class="mt-1.5 flex items-center gap-2">
                  <input
                    readonly
                    class="bg-input/50 border border-border/30 rounded-lg px-2 py-1 text-[10px] text-muted-foreground w-44 font-mono hover:bg-input transition-colors"
                    :value="`http://localhost:${agent.gateway_port}/?token=${agent.gateway_token}#token=${agent.gateway_token}`"
                    @click.stop="$event.target.select()"
                  />
                  <button 
                    class="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    @click.stop="copyToClipboard(`http://localhost:${agent.gateway_port}/?token=${agent.gateway_token}#token=${agent.gateway_token}`)"
                  >
                    复制地址
                  </button>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <button 
                v-if="agent.status === 'running'" 
                class="px-3 py-1.5 rounded-xl hover:bg-info/15 text-info hover:shadow-sm transition-all inline-flex items-center gap-1.5 font-medium" 
                title="打开控制面板" 
                @click="openDashboard(agent)"
              >
                <span class="i-carbon-launch text-sm" />
                <span class="text-xs">控制面板</span>
              </button>
              <span v-if="agent.health_ok" class="w-2.5 h-2.5 rounded-full bg-success shadow-sm animate-pulse" title="健康" />
              <span v-else-if="agent.status === 'running'" class="w-2.5 h-2.5 rounded-full bg-warning shadow-sm animate-pulse" title="等待健康检查" />
              <span
                class="px-3 py-1 rounded-xl text-xs font-semibold shadow-sm"
                :class="{
                  'bg-success/15 text-success border border-success/20': agent.status === 'running',
                  'bg-muted/50 text-muted-foreground border border-border/30': agent.status === 'stopped',
                  'bg-error/15 text-error border border-error/20': agent.status === 'error',
                }"
              >
                {{ agent.status === 'running' ? '运行中' : agent.status === 'error' ? '异常' : '已停止' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
