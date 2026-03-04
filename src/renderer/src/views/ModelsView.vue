<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { modelsApi } from '@/api'

interface Model {
  id: string
  name: string
}

interface Provider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  api: string
  enabled: boolean
  models: Model[]
}

const providers = ref<Provider[]>([])
const loading = ref(false)
const saving = ref(false)

const selectedProvider = ref<Provider | null>(null)

onMounted(() => {
  loadProviders()
})

async function loadProviders() {
  loading.value = true
  try {
    const res = await modelsApi.getProviders()
    providers.value = res as Provider[]
    if (providers.value.length > 0 && !selectedProvider.value) {
      selectedProvider.value = providers.value[0]
    } else if (selectedProvider.value) {
      selectedProvider.value = providers.value.find(p => p.id === selectedProvider.value!.id) || providers.value[0]
    }
  } catch (err) {
    console.error('Failed to load providers', err)
  } finally {
    loading.value = false
  }
}

async function saveAll() {
  saving.value = true
  try {
    await modelsApi.saveProviders(providers.value)
    // Show temporary success feedback
    const btn = document.getElementById('save-btn')
    if (btn) {
      const oldText = btn.innerText
      btn.innerText = '已保存!'
      setTimeout(() => { btn.innerText = oldText }, 2000)
    }
  } catch (err) {
    alert('保存失败: ' + err)
  } finally {
    saving.value = false
  }
}

function addProvider() {
  const id = `provider_${Date.now()}`
  const newProvider: Provider = {
    id,
    name: '新建供应商',
    baseUrl: 'https://',
    apiKey: '',
    api: 'openai-compatible',
    enabled: true,
    models: []
  }
  providers.value.push(newProvider)
  selectedProvider.value = newProvider
}

function removeProvider(p: Provider) {
  if (!confirm(`确定要删除供应商 "${p.name}" 吗？`)) return
  providers.value = providers.value.filter(x => x.id !== p.id)
  if (selectedProvider.value?.id === p.id) {
    selectedProvider.value = providers.value[0] || null
  }
}

function addModel(p: Provider) {
  p.models.push({ id: '', name: '' })
}

function removeModel(p: Provider, index: number) {
  p.models.splice(index, 1)
}

</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Page Header with Enhanced Style -->
    <div class="flex items-center justify-between mb-6 pb-4 border-b border-border/50 shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <span class="i-carbon-machine-learning-model text-2xl text-primary"></span>
        </div>
        <div>
          <h1 class="text-2xl font-bold">模型配置</h1>
          <p class="text-sm text-muted-foreground mt-0.5">管理 AI 模型供应商与模型列表</p>
        </div>
      </div>
      <div class="flex gap-2.5">
        <button
          class="px-5 py-2.5 border border-border/50 rounded-xl text-sm font-medium hover:bg-accent hover:border-border transition-all hover:shadow-sm inline-flex items-center gap-2"
          @click="addProvider"
        >
          <span class="i-carbon-add text-base" /> 添加供应商
        </button>
        <button
          id="save-btn"
          class="px-5 py-2.5 bg-gradient-to-r from-success to-success/90 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:scale-105 transition-all shadow-md inline-flex items-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
          :disabled="saving"
          @click="saveAll"
        >
          <span class="i-carbon-save text-base" /> 
          <span v-if="!saving">保存配置</span>
          <span v-else>保存中...</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-muted-foreground">
      <div class="flex flex-col items-center gap-3">
        <span class="i-svg-spinners-ring-resize text-4xl text-primary" />
        <p class="text-sm">加载模型配置...</p>
      </div>
    </div>

    <div v-else class="flex-1 flex gap-6 min-h-0">
      <!-- Left sidebar: Providers List with Enhanced Style -->
      <div class="w-72 bg-card border border-border/50 rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-sm">
        <div class="p-4 border-b border-border/30 bg-gradient-to-r from-surface-variant/40 to-transparent">
          <div class="flex items-center gap-2">
            <span class="i-carbon-settings-services text-lg text-primary"></span>
            <h2 class="text-sm font-bold">供应商列表</h2>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <button
            v-for="p in providers" :key="p.id"
            class="w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center justify-between group"
            :class="selectedProvider?.id === p.id 
              ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-semibold shadow-sm border border-primary/20' 
              : 'text-foreground hover:bg-accent/60 hover:shadow-sm border border-transparent'"
            @click="selectedProvider = p"
          >
            <div class="flex items-center gap-2.5 overflow-hidden">
              <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" :class="p.enabled ? 'bg-success animate-pulse' : 'bg-muted-foreground'" />
              <span class="truncate">{{ p.name || '未命名供应商' }}</span>
            </div>
            <span
              v-if="selectedProvider?.id === p.id"
              class="i-carbon-trash-can opacity-0 group-hover:opacity-100 text-error/70 hover:text-error transition-all p-1 rounded-lg hover:bg-error/10"
              @click.stop="removeProvider(p)"
              title="删除供应商"
            />
          </button>
          
          <div v-if="providers.length === 0" class="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div class="w-14 h-14 rounded-2xl bg-surface-variant/50 flex items-center justify-center mb-3">
              <span class="i-carbon-settings-services text-2xl opacity-30"></span>
            </div>
            <p class="text-xs">暂无供应商</p>
          </div>
        </div>
      </div>

      <!-- Right panel: Provider Details with Enhanced Style -->
      <div v-if="selectedProvider" class="flex-1 bg-card border border-border/50 rounded-2xl overflow-y-auto p-7 shadow-sm">
        <div class="max-w-3xl">
          <div class="flex items-center justify-between mb-7 pb-4 border-b border-border/30">
            <h2 class="text-lg font-bold flex items-center gap-2.5">
              <span class="i-carbon-api-1 text-xl text-primary" /> 基本信息
            </h2>
            <label class="flex items-center gap-2.5 px-4 py-2 bg-surface-variant/50 rounded-xl text-sm font-medium cursor-pointer hover:bg-surface-variant transition-colors">
              <input type="checkbox" v-model="selectedProvider.enabled" class="w-4 h-4 rounded border-input text-primary focus:ring-primary accent-primary" />
              <span>启用该供应商</span>
            </label>
          </div>

          <div class="space-y-6">
            <div class="grid grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-semibold mb-2 text-foreground/90">供应商标识 (ID)</label>
                <input 
                  v-model="selectedProvider.id" 
                  class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input font-mono" 
                />
              </div>
              <div>
                <label class="block text-sm font-semibold mb-2 text-foreground/90">显示名称</label>
                <input 
                  v-model="selectedProvider.name" 
                  class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input" 
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">Base URL</label>
              <input 
                v-model="selectedProvider.baseUrl" 
                placeholder="https://api.openai.com/v1" 
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input font-mono" 
              />
            </div>

            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">API Key</label>
              <div class="relative">
                <input 
                  v-model="selectedProvider.apiKey" 
                  type="password" 
                  placeholder="sk-..." 
                  class="w-full px-4 py-2.5 pr-10 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 font-mono transition-all hover:border-input" 
                />
                <span class="absolute right-3 top-3 i-carbon-password text-lg text-muted-foreground/50" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold mb-2 text-foreground/90">API 格式类型</label>
              <select 
                v-model="selectedProvider.api" 
                class="w-full px-4 py-2.5 bg-input-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 appearance-none transition-all hover:border-input"
              >
                <option value="openai-compatible">🔌 OpenAI 兼容格式 (推荐)</option>
                <option value="openai">🤖 OpenAI 原生</option>
                <option value="anthropic">🧠 Anthropic</option>
                <option value="gemini">✨ Gemini</option>
              </select>
            </div>
          </div>

          <div class="mt-10 mb-5 flex items-center justify-between pb-4 border-b border-border/30">
            <h2 class="text-lg font-bold flex items-center gap-2.5">
              <span class="i-carbon-machine-learning-model text-xl text-info" /> 
              <span>可用模型</span>
              <span class="px-2 py-0.5 bg-info/10 text-info rounded-full text-xs font-medium">{{ selectedProvider.models.length }}</span>
            </h2>
            <button 
              class="px-4 py-2 bg-info/10 text-info hover:bg-info/20 rounded-xl text-sm font-medium transition-all hover:shadow-sm inline-flex items-center gap-1.5" 
              @click="addModel(selectedProvider)"
            >
              <span class="i-carbon-add text-base" /> 添加模型
            </button>
          </div>

          <div class="space-y-3 bg-surface-variant/30 border border-border/30 rounded-2xl p-5">
            <div v-if="selectedProvider.models.length === 0" class="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div class="w-14 h-14 rounded-2xl bg-surface-variant/50 flex items-center justify-center mb-3">
                <span class="i-carbon-machine-learning-model text-2xl opacity-30"></span>
              </div>
              <p class="text-sm font-medium mb-1">尚未配置任何模型</p>
              <p class="text-xs text-muted-foreground/70">点击右上方添加第一个模型</p>
            </div>
            
            <div v-for="(m, idx) in selectedProvider.models" :key="idx" class="flex gap-3 items-start group">
              <div class="flex-1">
                <input 
                  v-model="m.id" 
                  placeholder="模型 ID (如 qwen-plus)" 
                  class="w-full px-4 py-2.5 bg-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 font-mono transition-all hover:border-input" 
                />
              </div>
              <div class="flex-1">
                <input 
                  v-model="m.name" 
                  placeholder="显示名称 (如 Qwen Plus)" 
                  class="w-full px-4 py-2.5 bg-background border border-input/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all hover:border-input" 
                />
              </div>
              <button 
                class="p-2.5 text-muted-foreground/50 hover:text-error hover:bg-error/15 rounded-xl transition-all shrink-0 opacity-0 group-hover:opacity-100" 
                @click="removeModel(selectedProvider, idx)"
                title="删除模型"
              >
                <span class="i-carbon-trash-can text-base" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="flex-1 bg-card border border-border rounded-xl flex items-center justify-center text-muted-foreground flex-col">
        <span class="i-carbon-select-window text-4xl mb-3 opacity-20" />
        <p>请在左侧选择或创建一个供应商</p>
      </div>
    </div>
  </div>
</template>
