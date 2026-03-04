<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { agentsApi, tasksApi, systemApi } from '@/api'

const stats = ref({
  totalAgents: 0,
  runningAgents: 0,
  totalTasks: 0,
  pendingTasks: 0,
  inProgressTasks: 0,
  completedTasks: 0,
  backendOk: false,
})

const loading = ref(true)

onMounted(async () => {
  const [agentsRes, tasksRes, healthRes] = await Promise.allSettled([
    agentsApi.list(),
    tasksApi.list(),
    systemApi.health(),
  ])

  if (agentsRes.status === 'fulfilled') {
    const agents = agentsRes.value as any[]
    stats.value.totalAgents = agents.length
    stats.value.runningAgents = agents.filter((a) => a.status === 'running').length
  }
  if (tasksRes.status === 'fulfilled') {
    const tasks = tasksRes.value as any[]
    stats.value.totalTasks = tasks.length
    stats.value.pendingTasks = tasks.filter((t) => t.status === 'pending').length
    stats.value.inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length
    stats.value.completedTasks = tasks.filter((t) => t.status === 'completed').length
  }
  if (healthRes.status === 'fulfilled') {
    stats.value.backendOk = true
  }
  loading.value = false
})

const cards = [
  { key: 'totalAgents', label: '智能体总数', icon: 'i-carbon-bot', color: 'text-primary' },
  { key: 'runningAgents', label: '运行中', icon: 'i-carbon-play-filled-alt', color: 'text-success' },
  { key: 'totalTasks', label: '任务总数', icon: 'i-carbon-task', color: 'text-info' },
  { key: 'pendingTasks', label: '待处理', icon: 'i-carbon-pending', color: 'text-warning' },
  { key: 'inProgressTasks', label: '进行中', icon: 'i-carbon-in-progress', color: 'text-primary' },
  { key: 'completedTasks', label: '已完成', icon: 'i-carbon-checkmark-filled', color: 'text-success' },
]
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">仪表盘</h1>
        <p class="text-sm text-muted-foreground mt-1">龙虾军团运行总览</p>
      </div>
      <span
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
        :class="stats.backendOk ? 'bg-success/10 text-success' : 'bg-error/10 text-error'"
      >
        <span class="w-2 h-2 rounded-full" :class="stats.backendOk ? 'bg-success' : 'bg-error'" />
        {{ stats.backendOk ? 'Gateway 在线' : 'Gateway 离线' }}
      </span>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20 text-muted-foreground">
      <span class="i-svg-spinners-ring-resize text-2xl mr-2" /> 加载中...
    </div>

    <template v-else>
      <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="card in cards"
          :key="card.key"
          class="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">{{ card.label }}</p>
              <p class="text-3xl font-bold mt-1" :class="card.color">
                {{ stats[card.key as keyof typeof stats] }}
              </p>
            </div>
            <span class="text-3xl opacity-20" :class="card.icon" />
          </div>
        </div>
      </div>

      <div class="mt-8 bg-card border border-border rounded-xl p-6">
        <h2 class="text-lg font-semibold mb-4">系统架构</h2>
        <div class="grid grid-cols-3 gap-4 text-center text-sm">
          <div class="bg-surface-variant rounded-lg p-4">
            <span class="i-carbon-bot text-2xl text-primary block mx-auto mb-2" />
            <p class="font-medium">主智能体</p>
            <p class="text-muted-foreground text-xs mt-1">需求分析与任务拆解</p>
          </div>
          <div class="bg-surface-variant rounded-lg p-4">
            <span class="i-carbon-logo-github text-2xl text-primary block mx-auto mb-2" />
            <p class="font-medium">Gitea :13000</p>
            <p class="text-muted-foreground text-xs mt-1">代码仓库与 Issue 管理</p>
          </div>
          <div class="bg-surface-variant rounded-lg p-4">
            <span class="i-carbon-container-software text-2xl text-primary block mx-auto mb-2" />
            <p class="font-medium">Worker 容器</p>
            <p class="text-muted-foreground text-xs mt-1">Docker 隔离执行</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
