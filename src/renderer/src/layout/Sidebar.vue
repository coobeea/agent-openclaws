<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { getGatewayClient } from '@/services/GatewayClient'

defineProps<{ collapsed: boolean }>()
defineEmits<{ toggle: [] }>()

const route = useRoute()
const app = useAppStore()
const gw = getGatewayClient()

const navItems = [
  { path: '/dashboard', label: '仪表盘', icon: 'i-carbon-dashboard' },
  { path: '/agents', label: '智能体', icon: 'i-carbon-bot' },
  { path: '/tasks', label: '任务', icon: 'i-carbon-task' },
  { path: '/gitea', label: 'Gitea', icon: 'i-carbon-logo-github' },
  { path: '/models', label: '模型配置', icon: 'i-carbon-machine-learning-model' },
  { path: '/settings', label: '设置', icon: 'i-carbon-settings' },
]

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <aside
    class="fixed left-0 top-0 h-screen bg-surface border-r border-border flex flex-col transition-all duration-200 z-30"
    :class="collapsed ? 'w-16' : 'w-56'"
  >
    <div class="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
      <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">OC</div>
      <span v-if="!collapsed" class="font-semibold text-sm whitespace-nowrap">OpenClaws</span>
    </div>

    <nav class="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
      <router-link
        v-for="item in navItems" :key="item.path" :to="item.path"
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
        :class="isActive(item.path) ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
      >
        <span class="text-lg shrink-0" :class="item.icon" />
        <span v-if="!collapsed" class="whitespace-nowrap">{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="border-t border-border p-2 shrink-0 space-y-1">
      <div class="flex items-center justify-center gap-1 text-xs" :class="gw.connected.value ? 'text-success' : 'text-error'">
        <span class="w-1.5 h-1.5 rounded-full" :class="gw.connected.value ? 'bg-success' : 'bg-error'" />
        <span v-if="!collapsed">{{ gw.connected.value ? '已连接' : '断开' }}</span>
      </div>
      <button class="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:bg-accent transition-colors" @click="$emit('toggle')">
        <span class="text-lg" :class="collapsed ? 'i-carbon-chevron-right' : 'i-carbon-chevron-left'" />
      </button>
      <button class="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:bg-accent transition-colors" @click="app.toggleDark">
        <span class="text-lg" :class="app.darkMode ? 'i-carbon-sun' : 'i-carbon-moon'" />
      </button>
    </div>
  </aside>
</template>
