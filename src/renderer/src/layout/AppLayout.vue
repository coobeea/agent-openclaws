<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import Sidebar from './Sidebar.vue'

const app = useAppStore()
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background text-foreground">
    <Sidebar :collapsed="app.sidebarCollapsed" @toggle="app.toggleSidebar" />
    <main class="flex-1 overflow-auto transition-all duration-300" :class="app.sidebarCollapsed ? 'ml-16' : 'ml-64'">
      <div class="p-8 max-w-[1920px] mx-auto"><router-view /></div>
    </main>
  </div>
</template>
