import { ref } from 'vue'
import type { GatewayRequest, GatewayResponse, GatewayEvent, GatewayOutMessage } from '@shared/gateway-protocol'
import { GatewayErrorCode } from '@shared/gateway-protocol'

export type EventListener = (payload: unknown) => void

interface PendingRequest {
  resolve: (payload: unknown) => void
  reject: (error: Error) => void
}

const RECONNECT_BASE = 2000
const RECONNECT_MAX = 30_000

export class GatewayClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()
  private eventListeners = new Map<string, Set<EventListener>>()
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reqId = 0

  connected = ref(false)

  connect(url: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.connected.value = true
      this.reconnectAttempts = 0
    }

    this.ws.onmessage = (ev) => {
      try {
        const msg: GatewayOutMessage = JSON.parse(ev.data)
        if (msg.type === 'res') this.handleResponse(msg)
        else if (msg.type === 'event') this.handleEvent(msg)
      } catch { /* ignore malformed */ }
    }

    this.ws.onclose = () => {
      this.connected.value = false
      this.rejectAll('Connection closed')
      this.scheduleReconnect(url)
    }

    this.ws.onerror = () => { /* onclose will fire */ }
  }

  async request(method: string, params?: Record<string, unknown>): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected')
    }
    const id = String(++this.reqId)
    const req: GatewayRequest = { type: 'req', id, method, params }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws!.send(JSON.stringify(req))
    })
  }

  on(event: string, listener: EventListener): () => void {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, new Set())
    this.eventListeners.get(event)!.add(listener)
    return () => this.eventListeners.get(event)?.delete(listener)
  }

  private handleResponse(msg: GatewayResponse): void {
    const pending = this.pending.get(msg.id)
    if (!pending) return
    this.pending.delete(msg.id)
    if (msg.ok) pending.resolve(msg.payload)
    else pending.reject(new Error(msg.error?.message || 'Unknown error'))
  }

  private handleEvent(msg: GatewayEvent): void {
    const listeners = this.eventListeners.get(msg.event)
    if (listeners) for (const fn of listeners) fn(msg.payload)
  }

  private rejectAll(reason: string): void {
    for (const [, p] of this.pending) { p.reject(new Error(reason)) }
    this.pending.clear()
  }

  private scheduleReconnect(url: string): void {
    if (this.reconnectTimer) return
    const delay = Math.min(RECONNECT_BASE * Math.pow(1.5, this.reconnectAttempts), RECONNECT_MAX)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(url)
    }, delay)
  }
}

let _client: GatewayClient | null = null

export function getGatewayClient(): GatewayClient {
  if (!_client) {
    _client = new GatewayClient()
    _client.connect(`ws://127.0.0.1:8765/gateway/ws`)
  }
  return _client
}
