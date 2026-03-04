<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { tasksApi } from '@/api'

interface Task {
  id: number
  title: string
  description: string | null
  status: string
  priority: string
  gitea_repo: string | null
  gitea_issue_number: number | null
  parent_id: number | null
  created_at: string
}

const tasks = ref<Task[]>([])
const loading = ref(false)
const filterStatus = ref('all')
const showCreate = ref(false)
const showDecompose = ref(false)

const createForm = ref({ title: '', description: '', priority: 'medium', gitea_repo: '' })
const decomposeForm = ref({ requirement: '', gitea_repo: '', priority: 'medium' })
const decomposing = ref(false)

const filteredTasks = computed(() => {
  if (filterStatus.value === 'all') return tasks.value
  return tasks.value.filter((t) => t.status === filterStatus.value)
})

async function loadTasks() {
  loading.value = true
  try {
    tasks.value = (await tasksApi.list()) as Task[]
  } catch {
    /* graceful */
  } finally {
    loading.value = false
  }
}

async function createTask() {
  if (!createForm.value.title) return
  try {
    await tasksApi.create(createForm.value)
    showCreate.value = false
    createForm.value = { title: '', description: '', priority: 'medium', gitea_repo: '' }
    await loadTasks()
  } catch {
    /* graceful */
  }
}

async function decomposeTasks() {
  if (!decomposeForm.value.requirement || !decomposeForm.value.gitea_repo) return
  decomposing.value = true
  try {
    await tasksApi.decompose(decomposeForm.value)
    showDecompose.value = false
    decomposeForm.value = { requirement: '', gitea_repo: '', priority: 'medium' }
    await loadTasks()
  } catch {
    /* graceful */
  } finally {
    decomposing.value = false
  }
}

async function syncToGitea(task: Task) {
  try {
    await tasksApi.syncGitea(task.id)
    await loadTasks()
  } catch {
    /* graceful */
  }
}

async function updateStatus(task: Task, status: string) {
  try {
    await tasksApi.update(task.id, { status })
    await loadTasks()
  } catch {
    /* graceful */
  }
}

async function deleteTask(task: Task) {
  if (!confirm(`确定删除任务 "${task.title}"？`)) return
  try {
    await tasksApi.delete(task.id)
    await loadTasks()
  } catch {
    /* graceful */
  }
}

const statusMap: Record<string, { cls: string; label: string }> = {
  pending: { cls: 'bg-warning/10 text-warning', label: '待处理' },
  in_progress: { cls: 'bg-info/10 text-info', label: '进行中' },
  completed: { cls: 'bg-success/10 text-success', label: '已完成' },
  failed: { cls: 'bg-error/10 text-error', label: '失败' },
}

const priorityMap: Record<string, { cls: string; label: string }> = {
  high: { cls: 'text-error', label: '高' },
  medium: { cls: 'text-warning', label: '中' },
  low: { cls: 'text-muted-foreground', label: '低' },
}

const filters = [
  { value: 'all', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'failed', label: '失败' },
]

onMounted(loadTasks)
</script>

<template>
  <div>
    <!-- Page Header with Enhanced Style -->
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-border/50">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center">
          <span class="i-carbon-task text-2xl text-info"></span>
        </div>
        <div>
          <h1 class="text-2xl font-bold">任务中心</h1>
          <p class="text-sm text-muted-foreground mt-0.5">管理和追踪所有任务</p>
        </div>
      </div>
      <div class="flex gap-2.5">
        <button
          class="px-5 py-2.5 border border-border/50 rounded-xl text-sm font-medium hover:bg-accent hover:border-border transition-all hover:shadow-sm inline-flex items-center gap-2"
          @click="showDecompose = true"
        >
          <span class="i-carbon-tree-view-alt text-base" /> 需求拆解
        </button>
        <button
          class="px-5 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all shadow-md inline-flex items-center gap-2"
          @click="showCreate = true"
        >
          <span class="i-carbon-add text-base" /> 新建任务
        </button>
      </div>
    </div>

    <!-- Filters with Enhanced Style -->
    <div class="flex gap-2 mb-5">
      <button
        v-for="f in filters" :key="f.value"
        class="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
        :class="filterStatus === f.value 
          ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md' 
          : 'bg-surface-variant/60 text-muted-foreground hover:text-foreground hover:bg-surface-variant hover:shadow-sm'"
        @click="filterStatus = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Create Dialog with Enhanced Style -->
    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 bg-overlay/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200" @click.self="showCreate = false">
        <div class="bg-card border border-border/50 rounded-2xl p-7 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
          <div class="flex items-center gap-3 mb-6 pb-4 border-b border-border/30">
            <div class="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center">
              <span class="i-carbon-add-alt text-xl"></span>
            </div>
            <h2 class="text-xl font-bold">新建任务</h2>
          </div>
          <div class="space-y-5">
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">任务标题</label>
              <input 
                v-model="createForm.title" 
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input" 
                placeholder="输入任务标题..."
              />
            </div>
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">任务描述</label>
              <textarea 
                v-model="createForm.description" 
                rows="4" 
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none transition-all hover:border-input" 
                placeholder="详细描述任务内容..."
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold mb-2 text-foreground/90">优先级</label>
                <select 
                  v-model="createForm.priority" 
                  class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input"
                >
                  <option value="high">🔴 高</option>
                  <option value="medium">🟡 中</option>
                  <option value="low">🟢 低</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-semibold mb-2 text-foreground/90">Gitea 仓库</label>
                <input 
                  v-model="createForm.gitea_repo" 
                  class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input" 
                  placeholder="owner/repo" 
                />
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-7 pt-5 border-t border-border/30">
            <button 
              class="px-5 py-2.5 border border-border/50 rounded-xl text-sm font-medium hover:bg-accent hover:border-border transition-all" 
              @click="showCreate = false"
            >
              取消
            </button>
            <button 
              class="px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-md" 
              :disabled="!createForm.title" 
              @click="createTask"
            >
              创建任务
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Decompose Dialog with Enhanced Style -->
    <Teleport to="body">
      <div v-if="showDecompose" class="fixed inset-0 bg-overlay/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200" @click.self="showDecompose = false">
        <div class="bg-card border border-border/50 rounded-2xl p-7 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
          <div class="flex items-center gap-3 mb-5 pb-4 border-b border-border/30">
            <div class="w-10 h-10 rounded-xl bg-warning/10 text-warning flex items-center justify-center">
              <span class="i-carbon-tree-view-alt text-xl"></span>
            </div>
            <div>
              <h2 class="text-xl font-bold">AI 需求拆解</h2>
              <p class="text-xs text-muted-foreground mt-0.5">输入完整需求，系统将自动拆解为原子任务</p>
            </div>
          </div>
          <div class="space-y-5">
            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">需求描述</label>
              <textarea 
                v-model="decomposeForm.requirement" 
                rows="6" 
                class="w-full px-4 py-3 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 resize-none transition-all hover:border-input leading-relaxed" 
                placeholder="例: 实现一个用户登录功能，需要支持手机号和邮箱两种方式..." 
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold mb-2 text-foreground/90">目标仓库</label>
                <input 
                  v-model="decomposeForm.gitea_repo" 
                  class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input" 
                  placeholder="owner/repo" 
                />
              </div>
              <div>
                <label class="block text-sm font-semibold mb-2 text-foreground/90">默认优先级</label>
                <select 
                  v-model="decomposeForm.priority" 
                  class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input"
                >
                  <option value="high">🔴 高</option>
                  <option value="medium">🟡 中</option>
                  <option value="low">🟢 低</option>
                </select>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-7 pt-5 border-t border-border/30">
            <button 
              class="px-5 py-2.5 border border-border/50 rounded-xl text-sm font-medium hover:bg-accent hover:border-border transition-all" 
              @click="showDecompose = false"
            >
              取消
            </button>
            <button
              class="px-6 py-2.5 bg-gradient-to-r from-warning to-warning/90 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-md inline-flex items-center gap-2"
              :disabled="!decomposeForm.requirement || !decomposeForm.gitea_repo || decomposing"
              @click="decomposeTasks"
            >
              <span v-if="decomposing" class="i-svg-spinners-ring-resize text-base" />
              {{ decomposing ? '拆解中...' : '开始拆解' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Task List with Enhanced Style -->
    <div v-if="loading" class="flex items-center justify-center py-32 text-muted-foreground">
      <div class="flex flex-col items-center gap-3">
        <span class="i-svg-spinners-ring-resize text-4xl text-primary" />
        <p class="text-sm">加载任务中...</p>
      </div>
    </div>

    <div v-else-if="filteredTasks.length === 0" class="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <div class="w-20 h-20 rounded-3xl bg-surface-variant/50 flex items-center justify-center mb-4">
        <span class="i-carbon-task text-4xl opacity-30" />
      </div>
      <p class="text-base font-medium mb-1">{{ filterStatus === 'all' ? '暂无任务' : '该状态下暂无任务' }}</p>
      <p class="text-xs text-muted-foreground/70">点击右上角创建第一个任务</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="task in filteredTasks" :key="task.id"
        class="bg-card border border-border/50 rounded-2xl p-5 hover:shadow-lg hover:border-border transition-all group"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2.5 mb-2">
              <span class="font-semibold text-sm">{{ task.title }}</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold shadow-sm" :class="(statusMap[task.status] || statusMap.pending).cls">
                {{ (statusMap[task.status] || statusMap.pending).label }}
              </span>
              <div class="flex items-center gap-1">
                <span class="i-carbon-flag-filled text-xs" :class="(priorityMap[task.priority] || priorityMap.medium).cls"></span>
                <span class="text-xs font-medium" :class="(priorityMap[task.priority] || priorityMap.medium).cls">
                  {{ (priorityMap[task.priority] || priorityMap.medium).label }}
                </span>
              </div>
            </div>
            <p v-if="task.description" class="text-sm text-muted-foreground/90 line-clamp-2 mt-1.5 leading-relaxed">{{ task.description }}</p>
            <div class="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span v-if="task.gitea_repo" class="inline-flex items-center gap-1.5 font-medium">
                <span class="i-carbon-logo-github" /> {{ task.gitea_repo }}
                <span v-if="task.gitea_issue_number" class="text-primary">#{{ task.gitea_issue_number }}</span>
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="i-carbon-time" /> {{ new Date(task.created_at).toLocaleDateString() }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 ml-4 shrink-0">
            <button v-if="task.status === 'pending'" class="p-2 rounded-xl hover:bg-info/15 text-info hover:shadow-sm transition-all" title="开始任务" @click="updateStatus(task, 'in_progress')">
              <span class="i-carbon-play-filled-alt text-base" />
            </button>
            <button v-if="task.status === 'in_progress'" class="p-2 rounded-xl hover:bg-success/15 text-success hover:shadow-sm transition-all" title="标记完成" @click="updateStatus(task, 'completed')">
              <span class="i-carbon-checkmark-filled text-base" />
            </button>
            <button v-if="task.gitea_repo && !task.gitea_issue_number" class="p-2 rounded-xl hover:bg-primary/15 text-primary hover:shadow-sm transition-all" title="同步到 Gitea" @click="syncToGitea(task)">
              <span class="i-carbon-cloud-upload text-base" />
            </button>
            <button class="p-2 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-error/15 text-error/70 hover:text-error transition-all" title="删除任务" @click="deleteTask(task)">
              <span class="i-carbon-trash-can text-base" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
