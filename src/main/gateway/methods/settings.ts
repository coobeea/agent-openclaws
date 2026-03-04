import type { MethodGroup } from '@shared/gateway-protocol'
import { configStore } from '@main/services/config-store'

export const settingsMethods: MethodGroup = {
  namespace: 'settings',
  methods: {
    getAll: async () => configStore.getAll(),

    get: async (p) => ({ key: p.key, value: configStore.get(String(p.key)) }),

    set: async (p) => {
      configStore.set(String(p.key), String(p.value))
      return { ok: true }
    },

    setBatch: async (p) => {
      const entries = p.entries as Record<string, string>
      if (!entries || typeof entries !== 'object') throw new Error('entries must be an object')
      configStore.setBatch(entries)
      return { ok: true }
    },
  },
}
