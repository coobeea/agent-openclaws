import { JsonlCollection } from './jsonl-store'

export interface ChannelConfig {
  id: number
  name: string
  type: 'feishu' | string
  config: Record<string, any>
  created_at: string
  updated_at: string
}

class ChannelManager {
  private store: JsonlCollection<ChannelConfig> = new JsonlCollection<ChannelConfig>('channels.jsonl')

  list(): ChannelConfig[] {
    return this.store.all()
  }

  get(id: number): ChannelConfig | null {
    return this.store.get(id) || null
  }

  create(name: string, type: string, config: Record<string, any>): ChannelConfig {
    return this.store.insert({
      name,
      type,
      config,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    } as any)
  }

  update(id: number, updates: Partial<Omit<ChannelConfig, 'id' | 'created_at' | 'updated_at'>>): ChannelConfig {
    return this.store.update(id, {
      ...updates,
      updated_at: new Date().toISOString()
    } as any) as ChannelConfig
  }

  delete(id: number): void {
    this.store.delete(id)
  }
}

export const channelManager = new ChannelManager()
