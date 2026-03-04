<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { agentsApi, modelsApi, giteaApi } from '@/api'
import { getGatewayClient } from '@/services/GatewayClient'

interface Agent {
  id: number
  name: string
  role: string
  status: string
  container_id: string | null
  gateway_port: number | null
  gateway_token: string | null
  workspace_path: string | null
  gitea_repo: string | null
  health_ok: number
  description: string | null
}

interface ModelProvider {
  id: string
  name: string
  models: { id: string; name: string }[]
}

const agents = ref<Agent[]>([])
const providers = ref<ModelProvider[]>([])
const giteaRepos = ref<string[]>([])
const loading = ref(false)
const showCreate = ref(false)
const createForm = ref({ name: '', role: 'worker', description: '', gitea_repo: '', model: '' })

const selectedAgent = ref<Agent | null>(null)
const rightTab = ref<'files' | 'logs'>('files')

const agentFiles = ref<string[]>([])
const editingFile = ref<{ name: string; content: string } | null>(null)
const saving = ref(false)

const logContent = ref('')
const loadingLogs = ref(false)
const logEl = ref<HTMLPreElement | null>(null)

let unsubAgentsUpdated: (() => void) | null = null

onMounted(() => {
  loadAgents()
  loadProviders()
  loadGiteaRepos()
  const gw = getGatewayClient()
  unsubAgentsUpdated = gw.on('agents.updated', (data: any) => {
    agents.value = data as Agent[]
  })
})

onUnmounted(() => {
  unsubAgentsUpdated?.()
})

async function loadAgents() {
  loading.value = true
  try { agents.value = (await agentsApi.list()) as Agent[] }
  catch { /* graceful */ }
  finally { loading.value = false }
}

async function loadProviders() {
  try {
    providers.value = (await modelsApi.getProviders()) as ModelProvider[]
    if (providers.value.length > 0 && providers.value[0].models.length > 0 && !createForm.value.model) {
      createForm.value.model = `${providers.value[0].id}|${providers.value[0].models[0].id}`
    }
  } catch { /* graceful */ }
}

async function loadGiteaRepos() {
  try {
    const res = await giteaApi.repos()
    giteaRepos.value = (res as any[]).map(r => r.full_name)
    if (giteaRepos.value.length > 0 && !createForm.value.gitea_repo) {
      createForm.value.gitea_repo = giteaRepos.value[0]
    }
  } catch (err) {
    console.warn('Failed to load Gitea repos', err)
  }
}

const errorMsg = ref('')

async function createAgent() {
  if (!createForm.value.name) return
  errorMsg.value = ''
  try {
    await agentsApi.create(createForm.value)
    showCreate.value = false
    const currentModel = createForm.value.model
    createForm.value = { name: '', role: 'worker', description: '', gitea_repo: giteaRepos.value[0] || '', model: currentModel }
    await loadAgents()
  } catch (e: any) {
    errorMsg.value = e.message || '创建失败'
  }
}

async function startAgent(agent: Agent) {
  try { await agentsApi.start(agent.id); await loadAgents() } catch { /* graceful */ }
}

async function stopAgent(agent: Agent) {
  try { await agentsApi.stop(agent.id); await loadAgents() } catch { /* graceful */ }
}

async function restartAgent(agent: Agent) {
  try { await agentsApi.restart(agent.id); await loadAgents() } catch { /* graceful */ }
}

async function deleteAgent(agent: Agent) {
  if (!confirm(`确定删除智能体 "${agent.name}"？容器也会被删除。`)) return
  try {
    await agentsApi.delete(agent.id)
    if (selectedAgent.value?.id === agent.id) { selectedAgent.value = null; editingFile.value = null }
    await loadAgents()
  } catch { /* graceful */ }
}

async function selectAgent(agent: Agent) {
  selectedAgent.value = agent
  editingFile.value = null
  rightTab.value = 'files'
  try { agentFiles.value = (await agentsApi.files(agent.id)) as string[] }
  catch { agentFiles.value = [] }
}

async function openFile(filename: string) {
  if (!selectedAgent.value) return
  try {
    const res = (await agentsApi.readFile(selectedAgent.value.id, filename)) as { filename: string; content: string }
    editingFile.value = { name: res.filename, content: res.content }
  } catch { /* graceful */ }
}

async function saveFile() {
  if (!selectedAgent.value || !editingFile.value) return
  saving.value = true
  try { await agentsApi.writeFile(selectedAgent.value.id, editingFile.value.name, editingFile.value.content) }
  catch { /* graceful */ }
  finally { saving.value = false }
}

async function loadLogs() {
  if (!selectedAgent.value) return
  loadingLogs.value = true
  try {
    const res = (await agentsApi.logs(selectedAgent.value.id, 300)) as { logs: string }
    logContent.value = res.logs
    await nextTick()
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  } catch (e: any) {
    logContent.value = `无法获取日志: ${e.message}`
  } finally {
    loadingLogs.value = false
  }
}

function switchToLogs() {
  rightTab.value = 'logs'
  loadLogs()
}

function openDashboard(agent: Agent) {
  if (agent.gateway_port) {
    const url = `http://localhost:${agent.gateway_port}/?token=${agent.gateway_token || ''}#token=${agent.gateway_token || ''}`
    window.open(url, '_blank')
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    // 可以在这里加个简单的提示，不过不加也行
    console.log('已复制')
  })
}

const statusMap: Record<string, { cls: string; label: string }> = {
  running: { cls: 'bg-success/10 text-success', label: '运行中' },
  stopped: { cls: 'bg-muted text-muted-foreground', label: '已停止' },
  error: { cls: 'bg-error/10 text-error', label: '异常' },
  creating: { cls: 'bg-warning/10 text-warning', label: '创建中' },
}
</script>

<template>
  <div>
    <!-- Page Header with Enhanced Style -->
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center">
          <span class="i-carbon-bot text-2xl text-warning"></span>
        </div>
        <div>
          <h1 class="text-2xl font-bold">智能体管理</h1>
          <p class="text-sm text-muted-foreground mt-0.5">管理龙虾军团中的所有 OpenClaw 实例</p>
        </div>
      </div>
      <button
        class="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all shadow-md inline-flex items-center gap-2"
        @click="showCreate = true"
      >
        <span class="i-carbon-add text-base" /> 创建龙虾
      </button>
    </div>

    <!-- Create Dialog with Enhanced Style -->
    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 bg-overlay/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200" @click.self="showCreate = false">
        <div class="bg-card border border-border/50 rounded-2xl p-7 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200">
          <div class="flex items-center gap-3 mb-6 pb-4 border-b border-border/30">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-warning/15 to-warning/5 text-warning flex items-center justify-center">
              <span class="i-carbon-bot-builder text-xl"></span>
            </div>
            <h2 class="text-xl font-bold">创建龙虾</h2>
          </div>
          <div class="space-y-5">
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">龙虾名称</label>
              <input 
                v-model="createForm.name" 
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input" 
                placeholder="例: worker-alpha" 
              />
            </div>
            <div>
              <label class="block text-sm font-semibold mb-2.5 text-foreground/90">选择角色</label>
              <div class="grid grid-cols-3 gap-3">
                <button
                  class="px-3 py-4 rounded-xl border transition-all hover:shadow-md"
                  :class="createForm.role === 'master' 
                    ? 'border-warning bg-gradient-to-br from-warning/15 to-warning/5 shadow-sm' 
                    : 'border-border/50 hover:border-warning/30 hover:bg-warning/5'"
                  @click="createForm.role = 'master'"
                >
                  <span class="i-carbon-crown-ambassador text-2xl block mx-auto mb-2" :class="createForm.role === 'master' ? 'text-warning' : 'text-muted-foreground'" />
                  <span class="font-semibold text-sm block" :class="createForm.role === 'master' ? 'text-warning' : ''">主龙虾</span>
                  <p class="text-[10px] text-muted-foreground mt-1 leading-relaxed">拆解分配任务</p>
                </button>
                <button
                  class="px-3 py-4 rounded-xl border transition-all hover:shadow-md"
                  :class="createForm.role === 'worker' 
                    ? 'border-info bg-gradient-to-br from-info/15 to-info/5 shadow-sm' 
                    : 'border-border/50 hover:border-info/30 hover:bg-info/5'"
                  @click="createForm.role = 'worker'"
                >
                  <span class="i-carbon-bot text-2xl block mx-auto mb-2" :class="createForm.role === 'worker' ? 'text-info' : 'text-muted-foreground'" />
                  <span class="font-semibold text-sm block" :class="createForm.role === 'worker' ? 'text-info' : ''">工龙虾</span>
                  <p class="text-[10px] text-muted-foreground mt-1 leading-relaxed">写代码提PR</p>
                </button>
                <button
                  class="px-3 py-4 rounded-xl border transition-all hover:shadow-md"
                  :class="createForm.role === 'qa' 
                    ? 'border-success bg-gradient-to-br from-success/15 to-success/5 shadow-sm' 
                    : 'border-border/50 hover:border-success/30 hover:bg-success/5'"
                  @click="createForm.role = 'qa'"
                >
                  <span class="i-carbon-security text-2xl block mx-auto mb-2" :class="createForm.role === 'qa' ? 'text-success' : 'text-muted-foreground'" />
                  <span class="font-semibold text-sm block" :class="createForm.role === 'qa' ? 'text-success' : ''">质检员</span>
                  <p class="text-[10px] text-muted-foreground mt-1 leading-relaxed">审查PR代码</p>
                </button>
              </div>
            </div>
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">选择模型</label>
              <select 
                v-model="createForm.model" 
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 appearance-none transition-all hover:border-input"
              >
                <optgroup v-for="p in providers" :key="p.id" :label="p.name">
                  <option v-for="m in p.models" :key="m.id" :value="`${p.id}|${m.id}`">{{ m.name }}</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">关联 Gitea 仓库</label>
              <select 
                v-if="giteaRepos.length > 0" 
                v-model="createForm.gitea_repo" 
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 appearance-none transition-all hover:border-input"
              >
                <option v-for="repo in giteaRepos" :key="repo" :value="repo">{{ repo }}</option>
              </select>
              <input 
                v-else 
                v-model="createForm.gitea_repo" 
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input" 
                placeholder="owner/repo (必填)" 
              />
              <p v-if="giteaRepos.length === 0" class="text-xs text-warning/80 mt-1.5 flex items-center gap-1">
                <span class="i-carbon-warning-alt"></span>
                <span>未获取到仓库列表，请手动输入或检查 Gitea 设置</span>
              </p>
            </div>
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">描述 <span class="text-muted-foreground font-normal">(可选)</span></label>
              <textarea 
                v-model="createForm.description" 
                rows="2" 
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none transition-all hover:border-input" 
                placeholder="描述这个龙虾的用途..." 
              />
            </div>
          </div>
          <p v-if="errorMsg" class="text-xs text-error mt-3 px-1 flex items-center gap-1">
            <span class="i-carbon-warning-filled"></span>
            <span>{{ errorMsg }}</span>
          </p>
          <div class="flex justify-end gap-3 mt-7 pt-5 border-t border-border/30">
            <button 
              class="px-5 py-2.5 border border-border/50 rounded-xl text-sm font-medium hover:bg-accent hover:border-border transition-all" 
              @click="showCreate = false; errorMsg = ''"
            >
              取消
            </button>
            <button 
              class="px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-md" 
              :disabled="!createForm.name || !createForm.gitea_repo" 
              @click="createAgent"
            >
              创建龙虾
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Content -->
    <div v-if="loading" class="flex items-center justify-center py-32 text-muted-foreground">
      <div class="flex flex-col items-center gap-3">
        <span class="i-svg-spinners-ring-resize text-4xl text-primary" />
        <p class="text-sm">加载龙虾列表...</p>
      </div>
    </div>

    <div v-else class="flex gap-6">
      <!-- Agent list -->
      <div class="flex-1 space-y-3 min-w-0">
        <div v-if="agents.length === 0" class="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div class="w-20 h-20 rounded-3xl bg-surface-variant/50 flex items-center justify-center mb-4">
            <span class="i-carbon-bot text-4xl opacity-30" />
          </div>
          <p class="text-base font-medium mb-1">暂无龙虾</p>
          <p class="text-xs text-muted-foreground/70">点击右上角创建第一个龙虾</p>
        </div>

        <div
          v-for="agent in agents" :key="agent.id"
          class="bg-card border border-border/50 rounded-2xl p-5 hover:shadow-lg transition-all cursor-pointer group"
          :class="selectedAgent?.id === agent.id ? 'ring-2 ring-primary shadow-lg' : ''"
          @click="selectAgent(agent)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div 
                class="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm"
                :class="agent.role === 'master' ? 'bg-gradient-to-br from-warning/15 to-warning/5' : agent.role === 'qa' ? 'bg-gradient-to-br from-success/15 to-success/5' : 'bg-gradient-to-br from-info/15 to-info/5'"
              >
                <span 
                  class="text-xl" 
                  :class="agent.role === 'master' ? 'i-carbon-crown-ambassador text-warning' : agent.role === 'qa' ? 'i-carbon-security text-success' : 'i-carbon-bot text-info'" 
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2.5">
                  <p class="font-semibold text-base">{{ agent.name }}</p>
                  <span v-if="agent.health_ok" class="w-2.5 h-2.5 rounded-full bg-success shadow-sm animate-pulse" title="健康" />
                </div>
                <p class="text-xs text-muted-foreground/80 mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span class="font-medium">{{ agent.role === 'master' ? '主龙虾' : (agent.role === 'qa' ? '质检员' : '工龙虾') }}</span>
                  <span class="text-muted-foreground/50">•</span>
                  <span class="font-mono">:{{ agent.gateway_port || '-' }}</span>
                  <span v-if="agent.gitea_repo">
                    <span class="text-muted-foreground/50">•</span>
                    <span class="i-carbon-logo-github text-xs"></span>
                    <span>{{ agent.gitea_repo }}</span>
                  </span>
                  <span v-if="agent.model">
                    <span class="text-muted-foreground/50">•</span>
                    <span class="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-medium">{{ agent.model }}</span>
                  </span>
                </p>
                <div v-if="agent.status === 'running' && agent.gateway_port" class="mt-2 flex items-center gap-2">
                  <input
                    readonly
                    class="bg-input/50 border border-border/30 rounded-lg px-2.5 py-1 text-[10px] text-muted-foreground w-52 font-mono hover:bg-input transition-colors"
                    :value="`http://localhost:${agent.gateway_port}/?token=${agent.gateway_token}#token=${agent.gateway_token}`"
                    @click.stop="$event.target.select()"
                  />
                  <button 
                    class="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    @click.stop="copyToClipboard(`http://localhost:${agent.gateway_port}/?token=${agent.gateway_token}#token=${agent.gateway_token}`)"
                  >
                    复制地址
                  </button>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="px-3 py-1 rounded-xl text-xs font-semibold shadow-sm" :class="(statusMap[agent.status] || statusMap.stopped).cls">
                {{ (statusMap[agent.status] || statusMap.stopped).label }}
              </span>
              <div class="flex gap-1" @click.stop>
                <button v-if="agent.status !== 'running'" class="p-2 rounded-xl hover:bg-success/15 text-success hover:shadow-sm transition-all" title="启动" @click="startAgent(agent)">
                  <span class="i-carbon-play-filled-alt text-base" />
                </button>
                <button v-if="agent.status === 'running'" class="p-2 rounded-xl hover:bg-warning/15 text-warning hover:shadow-sm transition-all" title="重启" @click="restartAgent(agent)">
                  <span class="i-carbon-restart text-base" />
                </button>
                <button v-if="agent.status === 'running'" class="p-2 rounded-xl hover:bg-info/15 text-info hover:shadow-sm transition-all" title="打开控制面板" @click="openDashboard(agent)">
                  <span class="i-carbon-launch text-base" />
                </button>
                <button v-if="agent.status === 'running'" class="p-2 rounded-xl hover:bg-error/15 text-error hover:shadow-sm transition-all" title="停止" @click="stopAgent(agent)">
                  <span class="i-carbon-stop-filled-alt text-base" />
                </button>
                <button class="p-2 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-error/15 text-error/70 hover:text-error transition-all" title="删除龙虾" @click="deleteAgent(agent)">
                  <span class="i-carbon-trash-can text-base" />
                </button>
              </div>
            </div>
          </div>
          <p v-if="agent.description" class="text-xs text-muted-foreground mt-2 line-clamp-2">{{ agent.description }}</p>
        </div>
      </div>

      <!-- Right panel: files / logs -->
      <div v-if="selectedAgent" class="w-[420px] bg-card border border-border rounded-xl p-4 shrink-0 self-start sticky top-6">
        <!-- Tab bar -->
        <div class="flex items-center gap-1 mb-3 bg-surface-variant rounded-lg p-1">
          <button
            class="flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center justify-center gap-1"
            :class="rightTab === 'files' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
            @click="rightTab = 'files'"
          >
            <span class="i-carbon-folder" /> 工作区
          </button>
          <button
            class="flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center justify-center gap-1"
            :class="rightTab === 'logs' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'"
            @click="switchToLogs"
          >
            <span class="i-carbon-terminal" /> 日志
          </button>
        </div>

        <!-- Files tab -->
        <div v-if="rightTab === 'files'">
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
                :disabled="saving" @click="saveFile"
              >
                {{ saving ? '...' : '保存' }}
              </button>
            </div>
            <textarea
              v-model="editingFile.content"
              class="w-full h-64 px-3 py-2 bg-input-background border border-input rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <!-- Logs tab -->
        <div v-if="rightTab === 'logs'">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">容器日志</span>
            <button class="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors" @click="loadLogs">
              <span class="i-carbon-renew" :class="loadingLogs ? 'animate-spin' : ''" /> 刷新
            </button>
          </div>
          <pre
            ref="logEl"
            class="w-full h-80 px-3 py-2 bg-input-background border border-input rounded-lg text-xs font-mono leading-relaxed overflow-auto whitespace-pre-wrap text-muted-foreground"
          >{{ logContent || (loadingLogs ? '加载中...' : '暂无日志（容器可能未启动）') }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
