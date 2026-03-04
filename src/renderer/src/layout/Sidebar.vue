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
  { path: '/lobby', label: '议事厅', icon: 'i-carbon-chat' },
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
    class="fixed left-0 top-0 h-screen bg-gradient-to-b from-surface to-surface/95 border-r border-border/50 flex flex-col transition-all duration-300 z-30 shadow-lg"
    :class="collapsed ? 'w-16' : 'w-64'"
  >
    <!-- Logo Header -->
    <div class="flex items-center gap-3 px-4 h-16 border-b border-border/30 shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md">
        🦞
      </div>
      <div v-if="!collapsed" class="flex flex-col">
        <span class="font-bold text-base tracking-tight">OpenClaws</span>
        <span class="text-[10px] text-muted-foreground">龙虾军团</span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
      <router-link
        v-for="item in navItems" :key="item.path" :to="item.path"
        class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all group relative"
        :class="isActive(item.path) 
          ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-semibold shadow-sm' 
          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground hover:shadow-sm'"
      >
        <span 
          class="text-xl shrink-0 transition-transform group-hover:scale-110" 
          :class="[item.icon, isActive(item.path) ? 'text-primary' : '']" 
        />
        <span v-if="!collapsed" class="whitespace-nowrap">{{ item.label }}</span>
        <div 
          v-if="isActive(item.path)" 
          class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full"
        ></div>
      </router-link>
    </nav>

    <!-- Footer -->
    <div class="border-t border-border/30 p-3 shrink-0 space-y-2 bg-surface-variant/20">
      <div 
        class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
        :class="gw.connected.value 
          ? 'bg-success/15 text-success border border-success/20' 
          : 'bg-error/15 text-error border border-error/20'"
      >
        <span class="w-2 h-2 rounded-full" :class="gw.connected.value ? 'bg-success animate-pulse' : 'bg-error'" />
        <span v-if="!collapsed">{{ gw.connected.value ? 'Gateway 在线' : 'Gateway 离线' }}</span>
      </div>
      <div class="flex gap-2">
        <button 
          class="flex items-center justify-center flex-1 py-2.5 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-all hover:shadow-sm" 
          @click="$emit('toggle')"
          title="展开/收起"
        >
          <span class="text-xl" :class="collapsed ? 'i-carbon-chevron-right' : 'i-carbon-chevron-left'" />
        </button>
        <button 
          class="flex items-center justify-center flex-1 py-2.5 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-all hover:shadow-sm" 
          @click="app.toggleDark"
          title="切换主题"
        >
          <span class="text-xl" :class="app.darkMode ? 'i-carbon-sun' : 'i-carbon-moon'" />
        </button>
      </div>
    </div>
  </aside>
</template>
