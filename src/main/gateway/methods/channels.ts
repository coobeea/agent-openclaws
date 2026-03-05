import { MethodGroup } from '../Gateway'
import { channelManager } from '../../services/channel-manager'

export const channelsMethods: MethodGroup = {
  prefix: 'channels',
  methods: {
    list: async () => {
      return channelManager.list()
    },
    create: async (params: any) => {
      if (!params.name || !params.type) throw new Error('Missing name or type')
      return channelManager.create(params.name, params.type, params.config || {})
    },
    update: async (params: any) => {
      if (!params.id) throw new Error('Missing id')
      return channelManager.update(Number(params.id), {
        name: params.name,
        type: params.type,
        config: params.config
      })
    },
    delete: async (params: any) => {
      if (!params.id) throw new Error('Missing id')
      channelManager.delete(Number(params.id))
      return { success: true }
    }
  }
}
