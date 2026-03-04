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
    <div class="flex items-center justify-between mb-6 shrink-0">
      <div>
        <h1 class="text-2xl font-bold">模型配置</h1>
        <p class="text-sm text-muted-foreground mt-1">管理支持的 AI 模型供应商、API Key 以及对应的模型列表。</p>
      </div>
      <div class="flex gap-3">
        <button
          class="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2"
          @click="addProvider"
        >
          <span class="i-carbon-add" /> 添加供应商
        </button>
        <button
          id="save-btn"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors flex items-center gap-2 disabled:opacity-50"
          :disabled="saving"
          @click="saveAll"
        >
          <span class="i-carbon-save" /> 保存配置
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-muted-foreground">
      <span class="i-svg-spinners-ring-resize text-3xl" />
    </div>

    <div v-else class="flex-1 flex gap-6 min-h-0">
      <!-- Left sidebar: Providers List -->
      <div class="w-64 bg-card border border-border rounded-xl flex flex-col overflow-hidden shrink-0">
        <div class="p-3 border-b border-border bg-surface-variant/50">
          <h2 class="text-sm font-semibold text-foreground">供应商列表</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            v-for="p in providers" :key="p.id"
            class="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between group"
            :class="selectedProvider?.id === p.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-accent'"
            @click="selectedProvider = p"
          >
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="w-2 h-2 rounded-full shrink-0" :class="p.enabled ? 'bg-success' : 'bg-muted-foreground'" />
              <span class="truncate">{{ p.name || '未命名' }}</span>
            </div>
            <span
              v-if="selectedProvider?.id === p.id"
              class="i-carbon-trash-can opacity-0 group-hover:opacity-100 text-error/70 hover:text-error transition-all"
              @click.stop="removeProvider(p)"
            />
          </button>
          
          <div v-if="providers.length === 0" class="text-center py-10 text-muted-foreground text-sm">
            暂无供应商
          </div>
        </div>
      </div>

      <!-- Right panel: Provider Details -->
      <div v-if="selectedProvider" class="flex-1 bg-card border border-border rounded-xl overflow-y-auto p-6">
        <div class="max-w-2xl">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <span class="i-carbon-api-1 text-primary" /> 基本信息
            </h2>
            <label class="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" v-model="selectedProvider.enabled" class="rounded border-input text-primary focus:ring-primary" />
              <span>启用该供应商</span>
            </label>
          </div>

          <div class="space-y-5">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1.5 text-muted-foreground">供应商标识 (ID)</label>
                <input v-model="selectedProvider.id" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1.5 text-muted-foreground">显示名称</label>
                <input v-model="selectedProvider.name" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5 text-muted-foreground">Base URL</label>
              <input v-model="selectedProvider.baseUrl" placeholder="https://api.openai.com/v1" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5 text-muted-foreground">API Key</label>
              <div class="relative">
                <input v-model="selectedProvider.apiKey" type="password" placeholder="sk-..." class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono" />
                <span class="absolute right-3 top-2.5 i-carbon-password text-muted-foreground" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1.5 text-muted-foreground">API 格式类型</label>
              <select v-model="selectedProvider.api" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none">
                <option value="openai-compatible">OpenAI 兼容格式 (推荐)</option>
                <option value="openai">OpenAI 原生</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
          </div>

          <div class="mt-10 mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <span class="i-carbon-machine-learning-model text-primary" /> 可用模型 ({{ selectedProvider.models.length }})
            </h2>
            <button class="text-sm text-primary hover:text-primary-hover font-medium flex items-center gap-1" @click="addModel(selectedProvider)">
              <span class="i-carbon-add" /> 添加模型
            </button>
          </div>

          <div class="space-y-3 bg-surface border border-border rounded-xl p-4">
            <div v-if="selectedProvider.models.length === 0" class="text-center py-6 text-muted-foreground text-sm">
              尚未配置任何模型，请点击右上方添加
            </div>
            
            <div v-for="(m, idx) in selectedProvider.models" :key="idx" class="flex gap-3 items-start">
              <div class="flex-1">
                <input v-model="m.id" placeholder="模型 ID (如 qwen-plus)" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono" />
              </div>
              <div class="flex-1">
                <input v-model="m.name" placeholder="显示名称 (如 Qwen Plus)" class="w-full px-3 py-2 bg-input-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <button class="p-2.5 text-muted-foreground hover:text-error hover:bg-error/10 rounded-lg transition-colors shrink-0" @click="removeModel(selectedProvider, idx)">
                <span class="i-carbon-trash-can" />
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
