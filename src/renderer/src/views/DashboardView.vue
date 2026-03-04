<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { agentsApi, tasksApi, systemApi, imageApi } from '@/api'

interface Agent { id: number; name: string; role: string; status: string; health_ok: number; gateway_port: number | null }

const agents = ref<Agent[]>([])
const tasks = ref<any[]>([])
const backendOk = ref(false)
const imageReady = ref(false)
const loading = ref(true)

const totalAgents = computed(() => agents.value.length)
const runningAgents = computed(() => agents.value.filter(a => a.status === 'running').length)
const healthyAgents = computed(() => agents.value.filter(a => a.health_ok).length)
const masterAgent = computed(() => agents.value.find(a => a.role === 'master'))

const totalTasks = computed(() => tasks.value.length)
const pendingTasks = computed(() => tasks.value.filter(t => t.status === 'pending').length)
const inProgressTasks = computed(() => tasks.value.filter(t => t.status === 'in_progress').length)
const completedTasks = computed(() => tasks.value.filter(t => t.status === 'completed').length)

onMounted(async () => {
  const [agentsRes, tasksRes, healthRes, imgRes] = await Promise.allSettled([
    agentsApi.list(),
    tasksApi.list(),
    systemApi.health(),
    imageApi.status(),
  ])

  if (agentsRes.status === 'fulfilled') agents.value = agentsRes.value as Agent[]
  if (tasksRes.status === 'fulfilled') tasks.value = tasksRes.value as any[]
  if (healthRes.status === 'fulfilled') backendOk.value = true
  if (imgRes.status === 'fulfilled') imageReady.value = (imgRes.value as any)?.exists ?? false
  loading.value = false
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">仪表盘</h1>
        <p class="text-sm text-muted-foreground mt-1">龙虾军团运行总览</p>
      </div>
      <div class="flex items-center gap-3">
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          :class="imageReady ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'"
        >
          <span class="i-carbon-cube" />
          {{ imageReady ? '镜像就绪' : '镜像未构建' }}
        </span>
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          :class="backendOk ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
        >
          <span class="w-2 h-2 rounded-full" :class="backendOk ? 'bg-success' : 'bg-error'" />
          {{ backendOk ? 'Gateway 在线' : 'Gateway 离线' }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20 text-muted-foreground">
      <span class="i-svg-spinners-ring-resize text-2xl mr-2" /> 加载中...
    </div>

    <template v-else>
      <!-- Agent stats -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-sm text-muted-foreground">龙虾总数</p>
          <p class="text-3xl font-bold mt-1 text-primary">{{ totalAgents }}</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-sm text-muted-foreground">运行中</p>
          <p class="text-3xl font-bold mt-1 text-success">{{ runningAgents }}</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-sm text-muted-foreground">健康</p>
          <p class="text-3xl font-bold mt-1" :class="healthyAgents === runningAgents && runningAgents > 0 ? 'text-success' : 'text-warning'">{{ healthyAgents }}</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-5">
          <p class="text-sm text-muted-foreground">任务总数</p>
          <p class="text-3xl font-bold mt-1 text-info">{{ totalTasks }}</p>
        </div>
      </div>

      <!-- Task stats -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-card border border-border rounded-xl p-4 text-center">
          <span class="i-carbon-pending text-2xl text-warning opacity-40 block mx-auto mb-1" />
          <p class="text-2xl font-bold text-warning">{{ pendingTasks }}</p>
          <p class="text-xs text-muted-foreground">待处理</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-4 text-center">
          <span class="i-carbon-in-progress text-2xl text-info opacity-40 block mx-auto mb-1" />
          <p class="text-2xl font-bold text-info">{{ inProgressTasks }}</p>
          <p class="text-xs text-muted-foreground">进行中</p>
        </div>
        <div class="bg-card border border-border rounded-xl p-4 text-center">
          <span class="i-carbon-checkmark-filled text-2xl text-success opacity-40 block mx-auto mb-1" />
          <p class="text-2xl font-bold text-success">{{ completedTasks }}</p>
          <p class="text-xs text-muted-foreground">已完成</p>
        </div>
      </div>

      <!-- Agent fleet -->
      <div class="bg-card border border-border rounded-xl p-6">
        <h2 class="text-lg font-semibold mb-4">军团阵容</h2>
        <div v-if="agents.length === 0" class="text-center py-8 text-muted-foreground">
          <p>暂无龙虾，前往智能体管理创建</p>
        </div>
        <div v-else class="space-y-2">
          <div v-for="agent in agents" :key="agent.id" class="flex items-center justify-between px-4 py-3 bg-surface-variant rounded-lg">
            <div class="flex items-center gap-3">
              <span :class="agent.role === 'master' ? 'i-carbon-crown text-warning' : 'i-carbon-bot text-primary'" class="text-lg" />
              <div>
                <span class="font-medium text-sm">{{ agent.name }}</span>
                <span class="text-xs text-muted-foreground ml-2">:{{ agent.gateway_port || '-' }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="agent.health_ok" class="w-2 h-2 rounded-full bg-success" title="健康" />
              <span v-else-if="agent.status === 'running'" class="w-2 h-2 rounded-full bg-warning animate-pulse" title="等待健康检查" />
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="{
                  'bg-success/10 text-success': agent.status === 'running',
                  'bg-muted text-muted-foreground': agent.status === 'stopped',
                  'bg-error/10 text-error': agent.status === 'error',
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
