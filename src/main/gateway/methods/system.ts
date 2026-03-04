import type { MethodGroup } from '@shared/gateway-protocol'
import { getGateway } from '@main/gateway/Gateway'

export const systemMethods: MethodGroup = {
  namespace: 'system',
  methods: {
    health: async () => ({ status: 'ok', name: 'OpenClaws', version: '0.1.0' }),

    methods: async () => {
      const gw = getGateway()
      return { methods: gw.listMethods() }
    }
  }
}
