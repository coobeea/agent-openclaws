<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { giteaApi } from '@/api'

type Tab = 'repos' | 'issues' | 'pulls'
const activeTab = ref<Tab>('repos')

interface Repo { id: number; full_name: string; description: string; html_url: string; stars_count: number; open_issues_count: number; updated_at: string }
interface Issue { number: number; title: string; state: string; html_url: string; labels: { name: string; color: string }[]; created_at: string }
interface Pull { number: number; title: string; state: string; html_url: string; merged: boolean; created_at: string }

const repos = ref<Repo[]>([])
const issues = ref<Issue[]>([])
const pulls = ref<Pull[]>([])
const loading = ref(false)

const selectedRepo = ref<{ owner: string; repo: string } | null>(null)
const issueState = ref('open')
const pullState = ref('open')

async function loadRepos() {
  loading.value = true
  try {
    repos.value = (await giteaApi.repos()) as Repo[]
  } catch { /* graceful */ } finally {
    loading.value = false
  }
}

async function selectRepo(fullName: string) {
  const [owner, repo] = fullName.split('/')
  selectedRepo.value = { owner, repo }
  activeTab.value = 'issues'
  await loadIssues()
}

async function loadIssues() {
  if (!selectedRepo.value) return
  loading.value = true
  try {
    issues.value = (await giteaApi.issues(selectedRepo.value.owner, selectedRepo.value.repo, issueState.value)) as Issue[]
  } catch { /* graceful */ } finally {
    loading.value = false
  }
}

async function loadPulls() {
  if (!selectedRepo.value) return
  loading.value = true
  try {
    pulls.value = (await giteaApi.pulls(selectedRepo.value.owner, selectedRepo.value.repo, pullState.value)) as Pull[]
  } catch { /* graceful */ } finally {
    loading.value = false
  }
}

async function mergePull(index: number) {
  if (!selectedRepo.value) return
  if (!confirm('确定合并该 Pull Request？')) return
  try {
    await giteaApi.mergePull(selectedRepo.value.owner, selectedRepo.value.repo, index)
    await loadPulls()
  } catch { /* graceful */ }
}

function switchTab(tab: Tab) {
  activeTab.value = tab
  if (tab === 'repos') loadRepos()
  else if (tab === 'issues') loadIssues()
  else if (tab === 'pulls') loadPulls()
}

function backToRepos() {
  selectedRepo.value = null
  activeTab.value = 'repos'
}

onMounted(loadRepos)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold">Gitea</h1>
        <p class="text-sm text-muted-foreground mt-1">
          <template v-if="selectedRepo">
            <button class="hover:text-primary transition-colors" @click="backToRepos">仓库</button>
            <span class="mx-1">/</span>
            <span class="text-foreground font-medium">{{ selectedRepo.owner }}/{{ selectedRepo.repo }}</span>
          </template>
          <template v-else>查看仓库、Issue 和 Pull Request</template>
        </p>
      </div>
    </div>

    <!-- Tabs (when repo selected) -->
    <div v-if="selectedRepo" class="flex gap-1 mb-4 bg-surface-variant rounded-lg p-1 w-fit">
      <button
        v-for="t in ([{ key: 'issues', label: 'Issues', icon: 'i-carbon-warning-alt' }, { key: 'pulls', label: 'Pull Requests', icon: 'i-carbon-branch' }] as const)"
        :key="t.key"
        class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1"
        :class="activeTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        @click="switchTab(t.key)"
      >
        <span :class="t.icon" /> {{ t.label }}
      </button>
    </div>

    <div v-if="loading" class="text-center py-20 text-muted-foreground">
      <span class="i-svg-spinners-ring-resize text-2xl" />
    </div>

    <template v-else>
      <!-- Repos -->
      <div v-if="activeTab === 'repos'" class="space-y-3">
        <div v-if="repos.length === 0" class="text-center py-16 text-muted-foreground">
          <span class="i-carbon-logo-github text-4xl block mx-auto mb-2 opacity-30" />
          <p>未找到仓库，请确认 Gitea 服务和 Token 配置</p>
        </div>
        <div
          v-for="repo in repos" :key="repo.id"
          class="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
          @click="selectRepo(repo.full_name)"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-primary">{{ repo.full_name }}</p>
              <p v-if="repo.description" class="text-xs text-muted-foreground mt-1 line-clamp-1">{{ repo.description }}</p>
            </div>
            <div class="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
              <span class="inline-flex items-center gap-1"><span class="i-carbon-star" /> {{ repo.stars_count }}</span>
              <span class="inline-flex items-center gap-1"><span class="i-carbon-warning-alt" /> {{ repo.open_issues_count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Issues -->
      <div v-if="activeTab === 'issues' && selectedRepo">
        <div class="flex gap-2 mb-4">
          <button
            v-for="s in ['open', 'closed']" :key="s"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            :class="issueState === s ? 'bg-primary text-primary-foreground' : 'bg-surface-variant text-muted-foreground'"
            @click="issueState = s; loadIssues()"
          >
            {{ s === 'open' ? '开放' : '已关闭' }}
          </button>
        </div>
        <div v-if="issues.length === 0" class="text-center py-12 text-muted-foreground">暂无 Issue</div>
        <div v-else class="space-y-2">
          <div v-for="issue in issues" :key="issue.number" class="bg-card border border-border rounded-xl p-4">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">#{{ issue.number }}</span>
                  <span class="font-medium">{{ issue.title }}</span>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    v-for="label in issue.labels" :key="label.name"
                    class="px-1.5 py-0.5 rounded text-xs"
                    :style="{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }"
                  >
                    {{ label.name }}
                  </span>
                  <span class="text-xs text-muted-foreground">{{ new Date(issue.created_at).toLocaleDateString() }}</span>
                </div>
              </div>
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                :class="issue.state === 'open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'"
              >
                {{ issue.state }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pull Requests -->
      <div v-if="activeTab === 'pulls' && selectedRepo">
        <div class="flex gap-2 mb-4">
          <button
            v-for="s in ['open', 'closed']" :key="s"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            :class="pullState === s ? 'bg-primary text-primary-foreground' : 'bg-surface-variant text-muted-foreground'"
            @click="pullState = s; loadPulls()"
          >
            {{ s === 'open' ? '开放' : '已关闭' }}
          </button>
        </div>
        <div v-if="pulls.length === 0" class="text-center py-12 text-muted-foreground">暂无 Pull Request</div>
        <div v-else class="space-y-2">
          <div v-for="pr in pulls" :key="pr.number" class="bg-card border border-border rounded-xl p-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">#{{ pr.number }}</span>
                  <span class="font-medium">{{ pr.title }}</span>
                  <span v-if="pr.merged" class="px-1.5 py-0.5 rounded text-xs bg-purple-500/10 text-purple-500 font-medium">已合并</span>
                </div>
                <p class="text-xs text-muted-foreground mt-1">{{ new Date(pr.created_at).toLocaleDateString() }}</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="pr.state === 'open' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'"
                >
                  {{ pr.state }}
                </span>
                <button
                  v-if="pr.state === 'open' && !pr.merged"
                  class="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary-hover transition-colors"
                  @click="mergePull(pr.number)"
                >
                  合并
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
