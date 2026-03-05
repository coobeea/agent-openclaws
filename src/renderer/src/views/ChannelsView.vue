<template>
  <div class="h-full flex flex-col bg-background relative overflow-hidden">
    <!-- Background Decorators -->
    <div class="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

    <!-- Page Header -->
    <div class="flex-none px-8 py-6 border-b border-border/50 bg-card/30 backdrop-blur-sm z-10">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <span class="i-carbon-connection-signal text-2xl text-primary"></span>
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight">渠道配置</h1>
            <p class="text-sm text-muted-foreground mt-1">管理外部平台接入渠道（如飞书等）</p>
          </div>
        </div>
        <button
          @click="openCreateDialog"
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/20"
        >
          <span class="i-carbon-add text-lg"></span>
          添加渠道
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 p-8 overflow-y-auto z-10">
      <div v-if="loading" class="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <span class="i-svg-spinners-ring-resize text-4xl text-primary mb-4"></span>
        <p>加载中...</p>
      </div>

      <div v-else-if="channels.length === 0" class="flex flex-col items-center justify-center h-64 text-muted-foreground bg-card/30 border border-dashed border-border/50 rounded-2xl">
        <span class="i-carbon-api-1 text-5xl mb-4 opacity-50"></span>
        <p class="text-lg font-medium text-foreground">暂无配置的渠道</p>
        <p class="text-sm mt-1">点击右上角按钮添加第一个接入渠道</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="channel in channels"
          :key="channel.id"
          class="group bg-card border border-border/50 rounded-2xl p-6 hover:shadow-xl hover:border-primary/30 transition-all relative overflow-hidden"
        >
          <!-- Card Background Gradient -->
          <div class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div class="flex items-start justify-between relative z-10">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="getChannelColor(channel.type)">
                <span :class="getChannelIcon(channel.type)" class="text-xl"></span>
              </div>
              <div>
                <h3 class="font-semibold text-lg">{{ channel.name }}</h3>
                <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                  {{ formatChannelType(channel.type) }}
                </span>
              </div>
            </div>
            
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click="openEditDialog(channel)" class="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                <span class="i-carbon-edit"></span>
              </button>
              <button @click="deleteChannel(channel.id)" class="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                <span class="i-carbon-trash-can"></span>
              </button>
            </div>
          </div>

          <div class="mt-6 space-y-2 relative z-10 text-sm">
            <template v-if="channel.type === 'feishu'">
              <div class="flex justify-between items-center py-1 border-b border-border/30">
                <span class="text-muted-foreground">App ID:</span>
                <span class="font-mono text-foreground">{{ maskString(channel.config.app_id) }}</span>
              </div>
              <div class="flex justify-between items-center py-1 border-b border-border/30">
                <span class="text-muted-foreground">App Secret:</span>
                <span class="font-mono text-foreground">{{ channel.config.app_secret ? '••••••••••••' : '未设置' }}</span>
              </div>
            </template>
            <div class="text-xs text-muted-foreground mt-4 pt-2">
              最后更新: {{ new Date(channel.updated_at).toLocaleString() }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Dialog -->
    <div v-if="showDialog" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <!-- Dialog Header -->
        <div class="px-6 py-4 border-b border-border/50 bg-muted/30 flex justify-between items-center relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent"></div>
          <h3 class="text-lg font-semibold relative z-10">{{ isEditing ? '编辑渠道配置' : '添加接入渠道' }}</h3>
          <button @click="showDialog = false" class="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-background/50 rounded-lg transition-colors relative z-10">
            <span class="i-carbon-close text-xl"></span>
          </button>
        </div>

        <!-- Dialog Body -->
        <div class="p-6 overflow-y-auto space-y-5">
          <div class="space-y-1.5">
            <label class="text-sm font-medium">渠道名称 <span class="text-destructive">*</span></label>
            <input
              v-model="form.name"
              type="text"
              class="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="例如：开发组飞书机器人"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-sm font-medium">渠道类型 <span class="text-destructive">*</span></label>
            <select
              v-model="form.type"
              class="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              :disabled="isEditing"
            >
              <option value="feishu">飞书 (Lark)</option>
            </select>
          </div>

          <template v-if="form.type === 'feishu'">
            <div class="space-y-1.5">
              <label class="text-sm font-medium">App ID <span class="text-destructive">*</span></label>
              <input
                v-model="form.config.app_id"
                type="text"
                class="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                placeholder="cli_a1b2c3d4e5f6g7h8"
              />
            </div>
            
            <div class="space-y-1.5">
              <label class="text-sm font-medium">App Secret <span class="text-destructive">*</span></label>
              <input
                v-model="form.config.app_secret"
                type="password"
                class="w-full px-3 py-2 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
                placeholder="输入 App Secret"
              />
            </div>
          </template>
        </div>

        <!-- Dialog Footer -->
        <div class="px-6 py-4 border-t border-border/50 bg-muted/10 flex justify-end gap-3">
          <button
            @click="showDialog = false"
            class="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            @click="saveChannel"
            :disabled="!isFormValid || saving"
            class="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            <span v-if="saving" class="i-svg-spinners-180-ring"></span>
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { channelsApi } from '@/api'

const channels = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)
const showDialog = ref(false)
const isEditing = ref(false)
const editingId = ref<number | null>(null)

const form = ref({
  name: '',
  type: 'feishu',
  config: {
    app_id: '',
    app_secret: ''
  }
})

const isFormValid = computed(() => {
  if (!form.value.name.trim()) return false
  if (form.value.type === 'feishu') {
    return form.value.config.app_id.trim() && form.value.config.app_secret.trim()
  }
  return false
})

const loadChannels = async () => {
  try {
    loading.value = true
    const res = await channelsApi.list()
    channels.value = Array.isArray(res) ? res : []
  } catch (error) {
    console.error('Failed to load channels:', error)
  } finally {
    loading.value = false
  }
}

const openCreateDialog = () => {
  isEditing.value = false
  editingId.value = null
  form.value = {
    name: '',
    type: 'feishu',
    config: {
      app_id: '',
      app_secret: ''
    }
  }
  showDialog.value = true
}

const openEditDialog = (channel: any) => {
  isEditing.value = true
  editingId.value = channel.id
  form.value = {
    name: channel.name,
    type: channel.type,
    config: { ...channel.config }
  }
  showDialog.value = true
}

const saveChannel = async () => {
  try {
    saving.value = true
    if (isEditing.value && editingId.value) {
      await channelsApi.update(editingId.value, form.value)
    } else {
      await channelsApi.create(form.value)
    }
    await loadChannels()
    showDialog.value = false
  } catch (error) {
    console.error('Failed to save channel:', error)
  } finally {
    saving.value = false
  }
}

const deleteChannel = async (id: number) => {
  if (!confirm('确定要删除这个渠道配置吗？删除后龙虾可能无法正常连接。')) return
  try {
    await channelsApi.delete(id)
    await loadChannels()
  } catch (error) {
    console.error('Failed to delete channel:', error)
  }
}

const formatChannelType = (type: string) => {
  const map: Record<string, string> = {
    'feishu': '飞书'
  }
  return map[type] || type
}

const getChannelIcon = (type: string) => {
  switch (type) {
    case 'feishu': return 'i-carbon-chat'
    default: return 'i-carbon-api'
  }
}

const getChannelColor = (type: string) => {
  switch (type) {
    case 'feishu': return 'bg-[#00D6B9]/10 text-[#00D6B9]'
    default: return 'bg-primary/10 text-primary'
  }
}

const maskString = (str: string) => {
  if (!str) return ''
  if (str.length <= 8) return str
  return `${str.slice(0, 4)}...${str.slice(-4)}`
}

onMounted(() => {
  loadChannels()
})
</script>