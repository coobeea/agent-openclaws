<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import Sidebar from './Sidebar.vue'

const app = useAppStore()
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background text-foreground">
    <Sidebar :collapsed="app.sidebarCollapsed" @toggle="app.toggleSidebar" />
    <main class="flex-1 overflow-auto transition-all duration-200" :class="app.sidebarCollapsed ? 'ml-16' : 'ml-56'">
      <div class="p-6"><router-view /></div>
    </main>
  </div>
</template>
