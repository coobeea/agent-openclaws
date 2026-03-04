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
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">任务中心</h1>
        <p class="text-sm text-muted-foreground mt-1">管理和追踪所有任务</p>
      </div>
      <div class="flex gap-2">
        <button
          class="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors inline-flex items-center gap-1"
          @click="showDecompose = true"
        >
          <span class="i-carbon-tree-view-alt" /> 需求拆解
        </button>
        <button
          class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors inline-flex items-center gap-1"
          @click="showCreate = true"
        >
          <span class="i-carbon-add" /> 新建任务
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex gap-2 mb-4">
      <button
        v-for="f in filters" :key="f.value"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        :class="filterStatus === f.value ? 'bg-primary text-primary-foreground' : 'bg-surface-variant text-muted-foreground hover:text-foreground'"
        @click="filterStatus = f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Create Dialog -->
    <Teleport to="body">
      <div v-if="showCreate" class="fixed inset-0 bg-overlay/50 z-50 flex items-center justify-center" @click.self="showCreate = false">
        <div class="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-xl">
          <h2 class="text-lg font-semibold mb-4">新建任务</h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">标题</label>
              <input v-model="createForm.title" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">描述</label>
              <textarea v-model="createForm.description" rows="4" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">优先级</label>
                <select v-model="createForm.priority" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Gitea 仓库</label>
                <input v-model="createForm.gitea_repo" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="owner/repo" />
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <button class="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors" @click="showCreate = false">取消</button>
            <button class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50" :disabled="!createForm.title" @click="createTask">创建</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Decompose Dialog -->
    <Teleport to="body">
      <div v-if="showDecompose" class="fixed inset-0 bg-overlay/50 z-50 flex items-center justify-center" @click.self="showDecompose = false">
        <div class="bg-card border border-border rounded-xl p-6 w-full max-w-lg shadow-xl">
          <h2 class="text-lg font-semibold mb-4">需求拆解</h2>
          <p class="text-sm text-muted-foreground mb-4">输入完整需求，系统将自动拆解为原子任务</p>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">需求描述</label>
              <textarea v-model="decomposeForm.requirement" rows="6" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="详细描述你的需求..." />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">目标仓库</label>
                <input v-model="decomposeForm.gitea_repo" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="owner/repo" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">默认优先级</label>
                <select v-model="decomposeForm.priority" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-6">
            <button class="px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors" @click="showDecompose = false">取消</button>
            <button
              class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 inline-flex items-center gap-1"
              :disabled="!decomposeForm.requirement || !decomposeForm.gitea_repo || decomposing"
              @click="decomposeTasks"
            >
              <span v-if="decomposing" class="i-svg-spinners-ring-resize" />
              {{ decomposing ? '拆解中...' : '开始拆解' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Task List -->
    <div v-if="loading" class="text-center py-20 text-muted-foreground">
      <span class="i-svg-spinners-ring-resize text-2xl" />
    </div>

    <div v-else-if="filteredTasks.length === 0" class="text-center py-16 text-muted-foreground">
      <span class="i-carbon-task text-4xl block mx-auto mb-2 opacity-30" />
      <p>{{ filterStatus === 'all' ? '暂无任务' : '该状态下暂无任务' }}</p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="task in filteredTasks" :key="task.id"
        class="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium">{{ task.title }}</span>
              <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="(statusMap[task.status] || statusMap.pending).cls">
                {{ (statusMap[task.status] || statusMap.pending).label }}
              </span>
              <span class="text-xs font-medium" :class="(priorityMap[task.priority] || priorityMap.medium).cls">
                {{ (priorityMap[task.priority] || priorityMap.medium).label }}
              </span>
            </div>
            <p v-if="task.description" class="text-xs text-muted-foreground line-clamp-2 mt-1">{{ task.description }}</p>
            <div class="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span v-if="task.gitea_repo" class="inline-flex items-center gap-1">
                <span class="i-carbon-logo-github" /> {{ task.gitea_repo }}
                <span v-if="task.gitea_issue_number">#{{ task.gitea_issue_number }}</span>
              </span>
              <span class="inline-flex items-center gap-1">
                <span class="i-carbon-time" /> {{ new Date(task.created_at).toLocaleDateString() }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-1 ml-4 shrink-0">
            <button v-if="task.status === 'pending'" class="p-1.5 rounded-lg hover:bg-info/10 text-info transition-colors" title="开始" @click="updateStatus(task, 'in_progress')">
              <span class="i-carbon-play-filled-alt text-sm" />
            </button>
            <button v-if="task.status === 'in_progress'" class="p-1.5 rounded-lg hover:bg-success/10 text-success transition-colors" title="完成" @click="updateStatus(task, 'completed')">
              <span class="i-carbon-checkmark-filled text-sm" />
            </button>
            <button v-if="task.gitea_repo && !task.gitea_issue_number" class="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="同步到 Gitea" @click="syncToGitea(task)">
              <span class="i-carbon-cloud-upload text-sm" />
            </button>
            <button class="p-1.5 rounded-lg hover:bg-error/10 text-error/60 hover:text-error transition-colors" title="删除" @click="deleteTask(task)">
              <span class="i-carbon-trash-can text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
