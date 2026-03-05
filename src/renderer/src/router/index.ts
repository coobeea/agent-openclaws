import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/layout/AppLayout.vue'),
      redirect: '/dashboard',
      children: [
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'lobby', name: 'lobby', component: () => import('@/views/LobbyView.vue') },
        { path: 'agents', name: 'agents', component: () => import('@/views/AgentsView.vue') },
        { path: 'tasks', name: 'tasks', component: () => import('@/views/TasksView.vue') },
        { path: 'gitea', name: 'gitea', component: () => import('@/views/GiteaView.vue') },
        { path: 'models', name: 'models', component: () => import('@/views/ModelsView.vue') },
        { path: 'channels', name: 'channels', component: () => import('@/views/ChannelsView.vue') },
        { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
      ]
    }
  ]
})

export default router
