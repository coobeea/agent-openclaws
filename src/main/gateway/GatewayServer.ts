import { WebSocketServer, WebSocket } from 'ws'
import { randomUUID } from 'node:crypto'
import type { HttpServer } from '@main/server/httpServer'
import { log } from '@main/utils/logger'

export interface ClientMeta {
  connectionId: string
  connectedAt: number
  isAlive: boolean
}

export interface GatewayServerOptions {
  httpServer: HttpServer
  onMessage: (ws: WebSocket, data: string, meta: ClientMeta) => Promise<void>
}

export class GatewayServer {
  private wss: WebSocketServer | null = null
  private clients = new Map<WebSocket, ClientMeta>()
  private heartbeatInterval: NodeJS.Timeout | null = null
  private onMessage: GatewayServerOptions['onMessage']

  constructor(opts: GatewayServerOptions) {
    this.onMessage = opts.onMessage
    const httpSrv = opts.httpServer.getHttpServer()

    this.wss = new WebSocketServer({ noServer: true })

    httpSrv.on('upgrade', (req, socket, head) => {
      if (req.url === '/gateway/ws') {
        this.wss!.handleUpgrade(req, socket as any, head, (ws) => {
          this.wss!.emit('connection', ws, req)
        })
      }
    })

    this.wss.on('connection', (ws) => {
      const meta: ClientMeta = { connectionId: randomUUID(), connectedAt: Date.now(), isAlive: true }
      this.clients.set(ws, meta)
      log.info(`WS client connected: ${meta.connectionId}`)

      ws.on('pong', () => { meta.isAlive = true })

      ws.on('message', async (raw) => {
        try {
          await this.onMessage(ws, raw.toString(), meta)
        } catch (err) {
          log.error('WS message error:', err)
        }
      })

      ws.on('close', () => {
        this.clients.delete(ws)
        log.info(`WS client disconnected: ${meta.connectionId}`)
      })
    })

    this.heartbeatInterval = setInterval(() => {
      for (const [ws, meta] of this.clients) {
        if (!meta.isAlive) { ws.terminate(); this.clients.delete(ws); continue }
        meta.isAlive = false
        ws.ping()
      }
    }, 30_000)

    log.info('GatewayServer started on /gateway/ws')
  }

  broadcast(data: string): void {
    for (const [ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    }
  }

  send(ws: WebSocket, data: string): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(data)
  }

  getClientCount(): number {
    return this.clients.size
  }

  close(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    this.wss?.close()
  }
}
