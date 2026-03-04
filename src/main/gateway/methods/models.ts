import type { MethodGroup } from '@shared/gateway-protocol'
import { modelsStore, ModelProvider } from '@main/services/models-store'

export const modelsMethods: MethodGroup = {
  namespace: 'models',
  methods: {
    getProviders: async () => modelsStore.getProviders(),

    saveProviders: async (p) => {
      const providers = p.providers as ModelProvider[]
      if (!Array.isArray(providers)) throw new Error('providers must be an array')
      modelsStore.saveProviders(providers)
      return { ok: true }
    },
  },
}
