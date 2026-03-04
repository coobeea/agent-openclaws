<template>
  <div>
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-[600px]">
      <div class="flex flex-col items-center gap-3">
        <span class="i-svg-spinners-ring-resize text-4xl text-primary"></span>
        <p class="text-sm text-muted-foreground">加载议事厅...</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else>
    <!-- Page Header with Gradient -->
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <span class="i-carbon-chat-launch text-2xl text-primary"></span>
        </div>
        <div>
          <h1 class="text-2xl font-bold">龙虾议事厅</h1>
          <p class="text-sm text-muted-foreground mt-0.5">多龙虾协作群聊空间</p>
        </div>
      </div>
      <button
        class="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all hover:shadow-lg hover:scale-105 inline-flex items-center gap-2"
        @click="showCreateLobby = true"
      >
        <span class="i-carbon-add text-base" />
        创建议事厅
      </button>
    </div>

    <!-- Main Content: Left (Lobby List) + Right (Chat) -->
    <div class="flex gap-4" style="height: calc(100vh - 180px)">
      <!-- Left: Lobby List with Enhanced Style -->
      <div class="w-80 bg-card border border-border/50 rounded-2xl p-5 flex flex-col shrink-0 shadow-sm">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-border/30">
          <div class="flex items-center gap-2">
            <span class="i-carbon-group-presentation text-lg text-primary"></span>
            <h2 class="text-base font-semibold">我的议事厅</h2>
          </div>
          <div class="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
            {{ lobbies.length }}
          </div>
        </div>
        
        <div v-if="lobbies.length === 0" class="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <div class="w-16 h-16 rounded-2xl bg-surface-variant/50 flex items-center justify-center mb-3">
            <span class="i-carbon-chat text-3xl opacity-30"></span>
          </div>
          <p class="text-sm font-medium mb-1">暂无议事厅</p>
          <p class="text-xs">点击右上角创建第一个群组</p>
        </div>

        <div v-else class="space-y-2 overflow-y-auto flex-1 pr-1 -mr-1">
          <div
            v-for="lobby in lobbies"
            :key="lobby.id"
            class="p-3.5 rounded-xl border cursor-pointer transition-all group"
            :class="selectedLobby?.id === lobby.id 
              ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-sm' 
              : 'border-border/50 hover:border-primary/40 hover:shadow-sm hover:bg-accent/30'"
            @click="selectLobby(lobby)"
          >
            <div class="flex items-start justify-between mb-2.5">
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-semibold truncate mb-0.5" :class="selectedLobby?.id === lobby.id ? 'text-primary' : ''">{{ lobby.name }}</h3>
                <p v-if="lobby.description" class="text-xs text-muted-foreground truncate leading-relaxed">{{ lobby.description }}</p>
              </div>
              <button
                class="ml-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error/15 text-error/70 hover:text-error transition-all"
                @click.stop="deleteLobby(lobby)"
                title="删除议事厅"
              >
                <span class="i-carbon-trash-can text-sm"></span>
              </button>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex -space-x-1.5">
                <div
                  v-for="(member, idx) in lobby.members.slice(0, 6)"
                  :key="member"
                  class="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[11px] shadow-sm"
                  :class="getMemberAvatar(member)"
                  :title="getMemberName(member)"
                >
                  <span :class="getMemberIcon(member)"></span>
                </div>
                <div
                  v-if="lobby.members.length > 6"
                  class="w-6 h-6 rounded-full border-2 border-card bg-surface-variant text-muted-foreground flex items-center justify-center text-[10px] font-medium shadow-sm"
                  :title="`还有 ${lobby.members.length - 6} 位成员`"
                >
                  +{{ lobby.members.length - 6 }}
                </div>
              </div>
              <span class="text-xs text-muted-foreground font-medium">{{ lobby.members.length }} 人</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Chat Area with Enhanced Style -->
      <div class="flex-1 bg-card border border-border/50 rounded-2xl overflow-hidden flex flex-col shadow-sm">
        <div v-if="!selectedLobby" class="flex flex-col items-center justify-center h-full text-muted-foreground">
          <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4 shadow-sm">
            <span class="i-carbon-chat-launch text-4xl text-primary/60"></span>
          </div>
          <p class="text-base font-medium mb-1.5">选择一个议事厅开始聊天</p>
          <p class="text-xs text-muted-foreground/70">或者创建一个新的议事厅邀请龙虾</p>
        </div>

        <template v-else>
          <!-- Chat Header with Gradient Background -->
          <div class="h-16 shrink-0 border-b border-border/30 flex items-center justify-between px-6 bg-gradient-to-r from-surface-variant/40 via-surface-variant/20 to-transparent backdrop-blur-sm">
            <div class="flex items-center gap-3.5">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center shadow-sm">
                <span class="i-carbon-chat text-xl"></span>
              </div>
              <div>
                <h2 class="text-base font-semibold tracking-tight">{{ selectedLobby.name }}</h2>
                <p v-if="selectedLobby.description" class="text-xs text-muted-foreground/80 mt-0.5">{{ selectedLobby.description }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-4 py-2 border border-border/50 rounded-xl text-xs font-medium hover:bg-accent hover:border-border transition-all hover:shadow-sm inline-flex items-center gap-2"
                @click="showManageMembers = true"
              >
                <span class="i-carbon-user-multiple text-base"></span>
                <span>{{ selectedLobby.members.length }} 位成员</span>
              </button>
            </div>
          </div>

          <!-- Messages List with Enhanced Styling -->
          <div class="flex-1 overflow-y-auto p-6 space-y-4" ref="messagesContainer" style="background: linear-gradient(to bottom, transparent, rgba(0,0,0,0.01))">
            <div v-if="currentMessages.length === 0" class="flex flex-col items-center justify-center h-full text-muted-foreground">
              <div class="w-16 h-16 rounded-2xl bg-surface-variant/50 flex items-center justify-center mb-3">
                <span class="i-carbon-chat text-3xl opacity-30"></span>
              </div>
              <p class="text-sm font-medium mb-1">暂无消息</p>
              <p class="text-xs text-muted-foreground/70">快来跟你的龙虾们打个招呼吧</p>
            </div>

            <div v-for="msg in currentMessages" :key="msg.id" class="flex gap-3 group" :class="{'flex-row-reverse': msg.role === 'human'}">
              <!-- Avatar with Shadow -->
              <div class="shrink-0">
                <div 
                  class="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all group-hover:shadow-md group-hover:scale-105"
                  :class="getRoleStyle(msg.role).bg"
                >
                  <span class="text-base" :class="getRoleStyle(msg.role).icon"></span>
                </div>
              </div>

              <!-- Message Body with Enhanced Bubble -->
              <div class="flex flex-col min-w-0 max-w-[70%]" :class="{'items-end': msg.role === 'human'}">
                <div class="flex items-baseline gap-2 mb-1 px-1" :class="{'flex-row-reverse': msg.role === 'human'}">
                  <span class="text-xs font-semibold" :class="getRoleStyle(msg.role).text">{{ msg.senderName }}</span>
                  <span class="text-[10px] text-muted-foreground/60 font-medium">{{ formatTime(msg.timestamp) }}</span>
                </div>
                <div 
                  class="px-4 py-2.5 rounded-2xl whitespace-pre-wrap break-words text-sm leading-relaxed shadow-sm"
                  :class="msg.role === 'human' 
                    ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground' 
                    : msg.role === 'system'
                    ? 'bg-surface-variant/70 border border-border/30 text-muted-foreground italic'
                    : 'bg-surface-variant/90 border border-border/20'"
                >
                  {{ msg.content }}
                </div>
              </div>
            </div>
          </div>

          <!-- Input Area with Enhanced Style -->
          <div class="border-t border-border/30 bg-gradient-to-b from-transparent to-surface-variant/20 p-5 backdrop-blur-sm">
            <form @submit.prevent="sendMessage" class="flex items-end gap-3">
              <div class="flex-1">
                <textarea
                  v-model="inputMessage"
                  @keydown.enter.exact.prevent="sendMessage"
                  rows="1"
                  placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
                  class="w-full rounded-xl border border-input/50 bg-background/80 backdrop-blur-sm px-4 py-3 text-sm transition-all placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none shadow-sm hover:border-input"
                  style="min-height: 48px; max-height: 120px"
                  @input="autoResize"
                  ref="textareaRef"
                ></textarea>
              </div>
              <button
                type="submit"
                :disabled="!inputMessage.trim() || sending"
                class="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/90 text-primary-foreground flex items-center justify-center hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all shadow-md"
                title="发送消息"
              >
                <span v-if="!sending" class="i-carbon-send-alt text-xl"></span>
                <span v-else class="i-svg-spinners-ring-resize text-xl"></span>
              </button>
            </form>
            <div class="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
              <span class="i-carbon-information"></span>
              <span>消息将同步发送给该议事厅的所有龙虾成员</span>
            </div>
          </div>
        </template>
      </div>
    </div>
    </div>

    <!-- Create Lobby Dialog with Enhanced Style -->
    <Teleport to="body">
      <div v-if="showCreateLobby" class="fixed inset-0 bg-overlay/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200" @click.self="showCreateLobby = false">
        <div class="bg-card border border-border/50 rounded-2xl p-7 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
          <div class="flex items-center gap-3 mb-6 pb-4 border-b border-border/30">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span class="i-carbon-add-alt text-xl"></span>
            </div>
            <h2 class="text-xl font-bold">创建议事厅</h2>
          </div>
          <div class="space-y-5">
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">议事厅名称</label>
              <input
                v-model="createForm.name"
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input"
                placeholder="例: 前端开发组"
              />
            </div>
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">描述 <span class="text-muted-foreground font-normal">(可选)</span></label>
              <textarea
                v-model="createForm.description"
                rows="2"
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none transition-all hover:border-input"
                placeholder="这个议事厅用来做什么..."
              ></textarea>
            </div>
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">邀请龙虾</label>
              <div class="space-y-1.5 max-h-52 overflow-y-auto border border-input/50 rounded-xl p-3 bg-surface-variant/20">
                <label
                  v-for="agent in agents"
                  :key="agent.id"
                  class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent/70 cursor-pointer transition-all group"
                >
                  <input
                    type="checkbox"
                    :value="agent.id.toString()"
                    v-model="createForm.members"
                    class="w-4 h-4 rounded border-input accent-primary"
                  />
                  <span
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-xs shadow-sm"
                    :class="agent.role === 'master' ? 'bg-warning/15 text-warning' : agent.role === 'qa' ? 'bg-success/15 text-success' : 'bg-info/15 text-info'"
                  >
                    <span :class="agent.role === 'master' ? 'i-carbon-crown' : agent.role === 'qa' ? 'i-carbon-security' : 'i-carbon-bot'"></span>
                  </span>
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium">{{ agent.name }}</span>
                    <span class="text-xs text-muted-foreground ml-2">({{ agent.role === 'master' ? '主龙虾' : agent.role === 'qa' ? '质检员' : '工龙虾' }})</span>
                  </div>
                </label>
                <div v-if="agents.length === 0" class="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <span class="i-carbon-bot text-2xl opacity-30 mb-2"></span>
                  <p class="text-xs">暂无龙虾，请先创建龙虾</p>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-7 pt-5 border-t border-border/30">
            <button
              class="px-5 py-2.5 border border-border/50 rounded-xl text-sm font-medium hover:bg-accent hover:border-border transition-all"
              @click="showCreateLobby = false; resetCreateForm()"
            >
              取消
            </button>
            <button
              class="px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-md"
              :disabled="!createForm.name.trim() || creating"
              @click="createLobby"
            >
              {{ creating ? '创建中...' : '创建议事厅' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Manage Members Dialog with Enhanced Style -->
    <Teleport to="body">
      <div v-if="showManageMembers && selectedLobby" class="fixed inset-0 bg-overlay/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200" @click.self="showManageMembers = false">
        <div class="bg-card border border-border/50 rounded-2xl p-7 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
          <div class="flex items-center gap-3 mb-6 pb-4 border-b border-border/30">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span class="i-carbon-user-multiple text-xl"></span>
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-xl font-bold">管理成员</h2>
              <p class="text-xs text-muted-foreground mt-0.5 truncate">{{ selectedLobby.name }}</p>
            </div>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-semibold mb-2.5 text-foreground/90">当前成员</label>
              <div class="space-y-1.5 max-h-64 overflow-y-auto">
                <div
                  v-for="member in selectedLobby.members"
                  :key="member"
                  class="flex items-center justify-between px-4 py-2.5 rounded-xl border border-border/50 hover:bg-accent/50 transition-all group"
                >
                  <div class="flex items-center gap-3">
                    <span
                      class="w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm"
                      :class="getMemberAvatar(member)"
                    >
                      <span :class="getMemberIcon(member)"></span>
                    </span>
                    <span class="text-sm font-medium">{{ getMemberName(member) }}</span>
                  </div>
                  <button
                    v-if="member !== 'human'"
                    class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error/15 text-error/70 hover:text-error transition-all"
                    @click="removeMember(member)"
                    title="移除成员"
                  >
                    <span class="i-carbon-subtract text-base"></span>
                  </button>
                  <span v-else class="text-xs text-muted-foreground/60 italic">创建者</span>
                </div>
              </div>
            </div>
            
            <div class="pt-4 border-t border-border/30">
              <label class="block text-sm font-semibold mb-2.5 text-foreground/90">添加龙虾</label>
              <div class="space-y-1.5 max-h-36 overflow-y-auto">
                <button
                  v-for="agent in availableAgents"
                  :key="agent.id"
                  class="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border/50 hover:border-primary hover:bg-primary/10 hover:shadow-sm transition-all text-left group"
                  @click="addMember(agent.id.toString())"
                >
                  <span
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm"
                    :class="agent.role === 'master' ? 'bg-warning/15 text-warning' : agent.role === 'qa' ? 'bg-success/15 text-success' : 'bg-info/15 text-info'"
                  >
                    <span :class="agent.role === 'master' ? 'i-carbon-crown' : agent.role === 'qa' ? 'i-carbon-security' : 'i-carbon-bot'"></span>
                  </span>
                  <div class="flex-1">
                    <span class="text-sm font-medium">{{ agent.name }}</span>
                    <span class="text-xs text-muted-foreground ml-2">({{ agent.role === 'master' ? '主龙虾' : agent.role === 'qa' ? '质检员' : '工龙虾' }})</span>
                  </div>
                  <span class="i-carbon-add opacity-0 group-hover:opacity-100 transition-all text-primary"></span>
                </button>
                <div v-if="availableAgents.length === 0" class="flex flex-col items-center justify-center py-6 text-muted-foreground">
                  <span class="i-carbon-checkmark-filled text-2xl text-success/50 mb-2"></span>
                  <p class="text-xs">所有龙虾都已加入</p>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end mt-6">
            <button
              class="px-6 py-2.5 border border-border/50 rounded-xl text-sm font-medium hover:bg-accent hover:border-border transition-all hover:shadow-sm"
              @click="showManageMembers = false"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { agentsApi } from '@/api'

interface HubMessage {
  id: number
  timestamp: number
  role: 'human' | 'master' | 'worker' | 'qa' | 'system'
  senderId: string
  senderName: string
  groupId: string
  content: string
}

interface Lobby {
  id: string
  name: string
  description: string
  members: string[]
  created_at: string
  updated_at: string
}

interface Agent {
  id: number
  name: string
  role: 'master' | 'worker' | 'qa'
  status: string
}

const lobbies = ref<Lobby[]>([])
const agents = ref<Agent[]>([])
const messages = ref<HubMessage[]>([])
const selectedLobby = ref<Lobby | null>(null)
const inputMessage = ref('')
const sending = ref(false)
const creating = ref(false)
const loading = ref(true)
const messagesContainer = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const showCreateLobby = ref(false)
const showManageMembers = ref(false)
const createForm = ref({ name: '', description: '', members: [] as string[] })

let pollTimer: number | null = null
let lastTimestamp = 0

const currentMessages = computed(() => {
  if (!selectedLobby.value) return []
  return messages.value.filter(m => m.groupId === selectedLobby.value!.id.toString())
})

const availableAgents = computed(() => {
  if (!selectedLobby.value) return []
  return agents.value.filter(a => !selectedLobby.value!.members.includes(a.id.toString()))
})

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const getRoleStyle = (role: string) => {
  const styles: Record<string, {bg: string, text: string, icon: string}> = {
    human: { bg: 'bg-gradient-to-br from-primary/15 to-primary/5 text-primary', text: 'text-primary font-semibold', icon: 'i-carbon-user-avatar' },
    master: { bg: 'bg-gradient-to-br from-warning/15 to-warning/5 text-warning', text: 'text-warning font-semibold', icon: 'i-carbon-crown-ambassador' },
    worker: { bg: 'bg-gradient-to-br from-info/15 to-info/5 text-info', text: 'text-info font-semibold', icon: 'i-carbon-bot' },
    qa: { bg: 'bg-gradient-to-br from-success/15 to-success/5 text-success', text: 'text-success font-semibold', icon: 'i-carbon-security' },
    system: { bg: 'bg-surface-variant/80 text-muted-foreground', text: 'text-muted-foreground/90 font-medium', icon: 'i-carbon-notification-new' }
  }
  return styles[role] || styles.system
}

const getMemberAvatar = (memberId: string) => {
  if (memberId === 'human') return 'bg-gradient-to-br from-primary/15 to-primary/5 text-primary'
  const agent = agents.value.find(a => a.id.toString() === memberId)
  if (!agent) return 'bg-surface-variant/80 text-muted-foreground'
  if (agent.role === 'master') return 'bg-gradient-to-br from-warning/15 to-warning/5 text-warning'
  if (agent.role === 'qa') return 'bg-gradient-to-br from-success/15 to-success/5 text-success'
  return 'bg-gradient-to-br from-info/15 to-info/5 text-info'
}

const getMemberIcon = (memberId: string) => {
  if (memberId === 'human') return 'i-carbon-user'
  const agent = agents.value.find(a => a.id.toString() === memberId)
  if (!agent) return 'i-carbon-user-avatar'
  if (agent.role === 'master') return 'i-carbon-crown'
  if (agent.role === 'qa') return 'i-carbon-security'
  return 'i-carbon-bot'
}

const getMemberName = (memberId: string) => {
  if (memberId === 'human') return '我'
  const agent = agents.value.find(a => a.id.toString() === memberId)
  return agent?.name || '未知成员'
}

const autoResize = () => {
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 100) + 'px'
  }
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const loadLobbies = async () => {
  try {
    const res = await fetch('http://127.0.0.1:8765/api/hub/lobbies')
    const json = await res.json()
    if (json.ok) {
      lobbies.value = json.data
      if (lobbies.value.length > 0 && !selectedLobby.value) {
        selectedLobby.value = lobbies.value[0]
        loadMessages()
      }
    }
  } catch (err) {
    console.error('Failed to load lobbies:', err)
  }
}

const loadAgents = async () => {
  try {
    agents.value = (await agentsApi.list()) as Agent[]
  } catch (err) {
    console.error('Failed to load agents:', err)
  }
}

const loadMessages = async () => {
  if (!selectedLobby.value) return
  try {
    const res = await fetch(`http://127.0.0.1:8765/api/hub/messages?groupId=${selectedLobby.value.id}&limit=100`)
    const json = await res.json()
    if (json.ok) {
      messages.value = json.data
      if (messages.value.length > 0) {
        lastTimestamp = messages.value[messages.value.length - 1].timestamp
      }
      scrollToBottom()
    }
  } catch (err) {
    console.error('Failed to load messages:', err)
  }
}

const fetchMessages = async () => {
  if (!selectedLobby.value) return
  try {
    const res = await fetch(`http://127.0.0.1:8765/api/hub/poll?groupId=${selectedLobby.value.id}&since=${lastTimestamp}`)
    const json = await res.json()
    if (json.ok && json.data.length > 0) {
      messages.value.push(...json.data)
      lastTimestamp = json.data[json.data.length - 1].timestamp
      scrollToBottom()
    }
  } catch (err) {
    console.error('Failed to fetch hub messages:', err)
  }
}

const startPolling = () => {
  const poll = async () => {
    await fetchMessages()
    pollTimer = window.setTimeout(poll, 2000)
  }
  poll()
}

const stopPolling = () => {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

const selectLobby = (lobby: Lobby) => {
  selectedLobby.value = lobby
  messages.value = []
  lastTimestamp = 0
  loadMessages()
}

const resetCreateForm = () => {
  createForm.value = { name: '', description: '', members: [] }
}

const createLobby = async () => {
  if (!createForm.value.name.trim() || creating.value) return
  creating.value = true
  try {
    const res = await fetch('http://127.0.0.1:8765/api/hub/lobbies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm.value)
    })
    const json = await res.json()
    if (json.ok) {
      await loadLobbies()
      selectedLobby.value = json.data
      showCreateLobby.value = false
      resetCreateForm()
    }
  } catch (err) {
    console.error('Failed to create lobby:', err)
  } finally {
    creating.value = false
  }
}

const deleteLobby = async (lobby: Lobby) => {
  if (!confirm(`确定删除议事厅"${lobby.name}"？`)) return
  try {
    await fetch(`http://127.0.0.1:8765/api/hub/lobbies/${lobby.id}`, { method: 'DELETE' })
    if (selectedLobby.value?.id === lobby.id) {
      selectedLobby.value = null
    }
    await loadLobbies()
  } catch (err) {
    console.error('Failed to delete lobby:', err)
  }
}

const addMember = async (agentId: string) => {
  if (!selectedLobby.value) return
  try {
    await fetch(`http://127.0.0.1:8765/api/hub/lobbies/${selectedLobby.value.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId })
    })
    await loadLobbies()
    selectedLobby.value = lobbies.value.find(l => l.id === selectedLobby.value!.id) || null
  } catch (err) {
    console.error('Failed to add member:', err)
  }
}

const removeMember = async (agentId: string) => {
  if (!selectedLobby.value) return
  try {
    await fetch(`http://127.0.0.1:8765/api/hub/lobbies/${selectedLobby.value.id}/members/${agentId}`, { method: 'DELETE' })
    await loadLobbies()
    selectedLobby.value = lobbies.value.find(l => l.id === selectedLobby.value!.id) || null
  } catch (err) {
    console.error('Failed to remove member:', err)
  }
}

const sendMessage = async () => {
  const text = inputMessage.value.trim()
  if (!text || sending.value || !selectedLobby.value) return

  sending.value = true
  try {
    await fetch('http://127.0.0.1:8765/api/hub/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'human',
        senderId: 'human',
        senderName: '我',
        groupId: selectedLobby.value.id,
        content: text
      })
    })
    inputMessage.value = ''
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  } catch (err) {
    console.error('Failed to send message:', err)
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([loadAgents(), loadLobbies()])
    startPolling()
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>