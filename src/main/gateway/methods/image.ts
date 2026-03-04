import type { MethodGroup } from '@shared/gateway-protocol'
import { imageBuilder } from '@main/services/image-builder'

export const imageMethods: MethodGroup = {
  namespace: 'image',
  methods: {
    status: async () => imageBuilder.status(),

    build: async (p) => {
      return imageBuilder.build({
        installBrowser: !!p.installBrowser,
        installDockerCli: !!p.installDockerCli,
      })
    },
  },
}
