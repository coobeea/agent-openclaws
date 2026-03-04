<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { agentsApi } from '@/api'

interface Agent {
  id: number
  name: string
  role: string
  status: string
  container_id: string | null
  gateway_port: number | null
  workspace_path: string | null
  description: string | null
}

const agents = ref<Agent[]>([])
const loading = ref(false)
const showCreate = ref(false)
const createForm = ref({ name: '', role: 'worker', description: '' })
const selectedAgent = ref<Agent | null>(null)
const agentFiles = ref<string[]>([])
const editingFile = ref<{ name: string; content: string } | null>(null)
const saving = ref(false)

async function loadAgents() {
  loading.value = true
  try {
    agents.value = (await agentsApi.list()) as Agent[]
  } catch {
    /* graceful */
  } finally {
    loading.value = false
  }
}

async function createAgent() {
  if (!createForm.value.name) return
  try {
    await agentsApi.create(createForm.value)
    showCreate.value = false
    createForm.value = { name: '', role: 'worker', description: '' }
    await loadAgents()
  } catch {
    /* graceful */
  }
}

async function startAgent(agent: Agent) {
  try {
    await agentsApi.start(agent.id, (agent.gateway_port || 7860) + agent.id)
    await loadAgents()
  } catch {
    /* graceful */
  }
}

async function stopAgent(agent: Agent) {
  try {
    await agentsApi.stop(agent.id)
    await loadAgents()
  } catch {
    /* graceful */
  }
}

async function restartAgent(agent: Agent) {
  try {
    await agentsApi.restart(agent.id)
    await loadAgents()
  } catch {
    /* graceful */
  }
}

async function deleteAgent(agent: Agent) {
  if (!confirm(`确定删除智能体 "${agent.name}"？`)) return
  try {
    await agentsApi.delete(agent.id)
    if (selectedAgent.value?.id === agent.id) {
      selectedAgent.value = null
      editingFile.value = null
    }
    await loadAgents()
  } catch {
    /* graceful */
  }
}

async function selectAgent(agent: Agent) {
  selectedAgent.value = agent
  editingFile.value = null
  try {
    agentFiles.value = (await agentsApi.files(agent.id)) as string[]
  } catch {
    agentFiles.value = []
  }
}

async function openFile(filename: string) {
  if (!selectedAgent.value) return
  try {
    const res = (await agentsApi.readFile(selectedAgent.value.id, filename)) as { filename: string; content: string }
    editingFile.value = { name: res.filename, content: res.content }
  } catch {
    /* graceful */
  }
}

async function saveFile() {
  if (!selectedAgent.value || !editingFile.value) return
  saving.value = true
  try {
    await agentsApi.writeFile(selectedAgent.value.id, editingFile.value.name, editingFile.value.content)
  } catch {
    /* graceful */
  } finally {
    saving.value = false
  }
}

const statusMap: Record<string, { cls: string; label: string }> = {
  running: { cls: 'bg-success/10 text-success', label: '运行中' },
  stopped: { cls: 'bg-muted text-muted-foreground', label: '已停止' },
  error: { cls: 'bg-error/10 text-error', label: '异常' },
  creating: { cls: 'bg-warning/10 text-warning', label: '创建中' },
}

onMounted(loadAgents)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">智能体管理</h1>
        <p class="text-sm text-muted-foreground mt-1">管理龙虾军团中的所有智能体实例</p>
      </div>
      <button
        class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors inline-flex items-center gap-1"
        @click="showCreate = true"
      >
        <span class="i-carbon-add" /> 创建智能体
      </button>
    </div>

    <!-- Create Dialog -->
    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 bg-overlay/50 z-50 flex items-center justify-center" @click.self="showCreate = false">
        <div class="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl">
          <h2 class="text-lg font-semibold mb-4">创建智能体</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">名称</label>
              <input v-model="createForm.name" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="例: worker-alpha" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">角色</label>
              <select v-model="createForm.role" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="worker">Worker</option>
                <option value="master">Master</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">描述</label>
              <textarea v-model="createForm.description" rows="3" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="可选" />
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <button class="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors" @click="showCreate = false">取消</button>
            <button class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50" :disabled="!createForm.name" @click="createAgent">创建</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Content -->
    <div v-if="loading" class="text-center py-20 text-muted-foreground">
      <span class="i-svg-spinners-ring-resize text-2xl" />
    </div>

    <div v-else class="flex gap-6">
      <!-- Agent list -->
      <div class="flex-1 space-y-3">
        <div v-if="agents.length === 0" class="text-center py-16 text-muted-foreground">
          <span class="i-carbon-bot text-4xl block mx-auto mb-2 opacity-30" />
          <p>暂无智能体，点击右上角创建</p>
        </div>

        <div
          v-for="agent in agents"
          :key="agent.id"
          class="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
          :class="selectedAgent?.id === agent.id ? 'ring-2 ring-primary' : ''"
          @click="selectAgent(agent)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <span class="text-lg" :class="agent.role === 'master' ? 'i-carbon-crown' : 'i-carbon-bot'" />
              </div>
              <div>
                <p class="font-medium">{{ agent.name }}</p>
                <p class="text-xs text-muted-foreground">{{ agent.role === 'master' ? '主智能体' : 'Worker' }} · 端口 {{ agent.gateway_port || '-' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="(statusMap[agent.status] || statusMap.stopped).cls">
                {{ (statusMap[agent.status] || statusMap.stopped).label }}
              </span>
              <div class="flex gap-1" @click.stop>
                <button v-if="agent.status !== 'running'" class="p-1.5 rounded-lg hover:bg-success/10 text-success transition-colors" title="启动" @click="startAgent(agent)">
                  <span class="i-carbon-play-filled-alt text-sm" />
                </button>
                <button v-if="agent.status === 'running'" class="p-1.5 rounded-lg hover:bg-warning/10 text-warning transition-colors" title="重启" @click="restartAgent(agent)">
                  <span class="i-carbon-restart text-sm" />
                </button>
                <button v-if="agent.status === 'running'" class="p-1.5 rounded-lg hover:bg-error/10 text-error transition-colors" title="停止" @click="stopAgent(agent)">
                  <span class="i-carbon-stop-filled-alt text-sm" />
                </button>
                <button class="p-1.5 rounded-lg hover:bg-error/10 text-error/60 hover:text-error transition-colors" title="删除" @click="deleteAgent(agent)">
                  <span class="i-carbon-trash-can text-sm" />
                </button>
              </div>
            </div>
          </div>
          <p v-if="agent.description" class="text-xs text-muted-foreground mt-2 line-clamp-2">{{ agent.description }}</p>
        </div>
      </div>

      <!-- Workspace file editor -->
      <div v-if="selectedAgent" class="w-96 bg-card border border-border rounded-xl p-4 shrink-0 self-start sticky top-6">
        <h3 class="font-semibold mb-3 flex items-center gap-2">
          <span class="i-carbon-folder text-primary" />
          {{ selectedAgent.name }} - 工作区
        </h3>
        <div class="space-y-1 mb-4 max-h-40 overflow-y-auto">
          <button
            v-for="f in agentFiles" :key="f"
            class="w-full text-left px-3 py-1.5 rounded-lg text-sm hover:bg-accent transition-colors flex items-center gap-1.5"
            :class="editingFile?.name === f ? 'bg-primary/10 text-primary' : 'text-muted-foreground'"
            @click="openFile(f)"
          >
            <span class="i-carbon-document text-xs" />{{ f }}
          </button>
          <p v-if="agentFiles.length === 0" class="text-xs text-muted-foreground px-3 py-2">工作区为空</p>
        </div>
        <div v-if="editingFile">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium font-mono">{{ editingFile.name }}</span>
            <button
              class="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
              :disabled="saving"
              @click="saveFile"
            >
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
          <textarea
            v-model="editingFile.content"
            class="w-full h-64 px-3 py-2 bg-input-background border border-input rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
      </div>
    </div>
  </div>
</template>
