import { JsonStore } from './jsonl-store'
import { log } from '@main/utils/logger'

export interface ModelProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  api: string
  enabled: boolean
  models: { id: string; name: string }[]
}

const DEFAULT_PROVIDERS: Record<string, ModelProvider> = {
  dashscope: {
    id: 'dashscope',
    name: '百炼 (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    api: 'openai-compatible',
    enabled: true,
    models: [
      { id: 'qwen-plus-latest', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
      { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus' }
    ]
  },
  silicon: {
    id: 'silicon',
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn',
    apiKey: '',
    api: 'openai-compatible',
    enabled: true,
    models: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek-V3' },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek-R1' }
    ]
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    api: 'openai',
    enabled: false,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
    ]
  },
  'dashscope-subscription': {
    id: 'dashscope-subscription',
    name: '百炼订阅版',
    baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    apiKey: '',
    api: 'openai-compatible',
    enabled: false,
    models: [
      { id: 'qwen3.5-plus', name: 'Qwen3.5 Plus' },
      { id: 'qwen3-max-2026-01-23', name: 'Qwen3 Max' },
      { id: 'qwen3-coder-next', name: 'Qwen3 Coder Next' },
      { id: 'qwen3-coder-plus', name: 'Qwen3 Coder Plus' },
      { id: 'glm-4.7', name: 'GLM-4.7' },
      { id: 'kimi-k2.5', name: 'Kimi-K2.5' }
    ]
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot AI',
    baseUrl: 'https://api.moonshot.cn',
    apiKey: '',
    api: 'openai-compatible',
    enabled: false,
    models: [
      { id: 'moonshot-v1-auto', name: 'Moonshot V1 Auto' }
    ]
  }
}

const store = new JsonStore('models.json')

export const modelsStore = {
  getProviders(): ModelProvider[] {
    const data = store.getAll()
    if (!data.providers || Object.keys(data.providers).length === 0) {
      return Object.values(DEFAULT_PROVIDERS)
    }
    return Object.values(data.providers as Record<string, ModelProvider>)
  },

  saveProviders(providers: ModelProvider[]): void {
    const map: Record<string, ModelProvider> = {}
    for (const p of providers) {
      map[p.id] = p
    }
    store.set('providers', map)
    log.info('Models configuration updated')
  }
}
