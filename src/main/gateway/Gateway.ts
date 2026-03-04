import type { WebSocket } from 'ws'
import Router from '@koa/router'
import { HttpServer } from '@main/server/httpServer'
import { GatewayServer, type ClientMeta } from './GatewayServer'
import { log } from '@main/utils/logger'
import {
  GatewayErrorCode,
  type GatewayRequest,
  type GatewayResponse,
  type GatewayEvent,
  type GatewayApi,
  type MethodHandler,
  type MethodGroup,
  type MethodContext
} from '@shared/gateway-protocol'

export class Gateway implements GatewayApi {
  private server: GatewayServer | null = null
  private methods = new Map<string, MethodHandler>()
  private httpRouter = new Router({ prefix: '/gateway' })

  start(): void {
    const httpServer = HttpServer.getInstance()
    if (!httpServer) { log.error('HttpServer not initialized'); return }

    this.server = new GatewayServer({
      httpServer,
      onMessage: (ws, data, meta) => this.handleMessage(ws, data, meta)
    })

    // Mount HTTP routes on Koa
    const app = httpServer.getApp()
    app.use(this.httpRouter.routes())
    app.use(this.httpRouter.allowedMethods())

    log.info(`Gateway started with ${this.methods.size} methods`)
  }

  registerMethodGroup(group: MethodGroup): void {
    for (const [action, handler] of Object.entries(group.methods)) {
      const fullName = `${group.namespace}.${action}`
      this.methods.set(fullName, handler)
    }
    log.info(`Registered method group: ${group.namespace} (${Object.keys(group.methods).length} methods)`)
  }

  getRouter(): Router {
    return this.httpRouter
  }

  listMethods(): string[] {
    return Array.from(this.methods.keys()).sort()
  }

  broadcastEvent(event: string, payload: unknown): void {
    const msg: GatewayEvent = { type: 'event', event, payload }
    this.server?.broadcast(JSON.stringify(msg))
  }

  private async handleMessage(ws: WebSocket, raw: string, meta: ClientMeta): Promise<void> {
    let parsed: GatewayRequest
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    if (parsed.type !== 'req' || !parsed.method) return

    const handler = this.methods.get(parsed.method)
    if (!handler) {
      this.sendResponse(ws, parsed.id, false, undefined, {
        code: GatewayErrorCode.METHOD_NOT_FOUND,
        message: `Method not found: ${parsed.method}`
      })
      return
    }

    const ctx: MethodContext = { clientId: meta.connectionId, gateway: this }

    try {
      const result = await handler(parsed.params || {}, ctx)
      this.sendResponse(ws, parsed.id, true, result)
    } catch (err: any) {
      log.error(`Method ${parsed.method} error:`, err)
      this.sendResponse(ws, parsed.id, false, undefined, {
        code: err.code || GatewayErrorCode.INTERNAL_ERROR,
        message: err.message || 'Internal error'
      })
    }
  }

  private sendResponse(ws: WebSocket, id: string, ok: boolean, payload?: unknown, error?: { code: number; message: string }): void {
    const res: GatewayResponse = { type: 'res', id, ok, ...(ok ? { payload } : { error }) }
    this.server?.send(ws, JSON.stringify(res))
  }
}

let _gateway: Gateway | null = null

export function getGateway(): Gateway {
  if (!_gateway) _gateway = new Gateway()
  return _gateway
}
