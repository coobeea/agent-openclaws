import http from 'node:http'
import path from 'node:path'
import { is } from '@electron-toolkit/utils'
import cors from '@koa/cors'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import serve from 'koa-static'
import { log } from '@main/utils/logger'

const PORT = 8765

export class HttpServer {
  private static _instance: HttpServer | null = null
  private app: Koa
  private httpServer!: http.Server

  constructor() {
    if (HttpServer._instance) throw new Error('HttpServer already initialized')
    this.app = new Koa()
    this.setupMiddleware()
    this.startServer()
    HttpServer._instance = this
  }

  static getInstance(): HttpServer | null {
    return HttpServer._instance
  }

  getHttpServer(): http.Server {
    return this.httpServer
  }

  getApp(): Koa {
    return this.app
  }

  private setupMiddleware(): void {
    this.app.use(cors({ origin: '*' }))
    this.app.use(bodyParser())

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const viteUrl = new URL(process.env['ELECTRON_RENDERER_URL'])
      this.app.use(this.createDevProxy(viteUrl.hostname, parseInt(viteUrl.port, 10)))
      log.info(`Dev proxy -> ${process.env['ELECTRON_RENDERER_URL']}`)
    } else {
      const staticPath = path.join(__dirname, '../renderer')
      this.app.use(serve(staticPath, { index: 'index.html', maxAge: 0, gzip: true }))
    }
  }

  private createDevProxy(host: string, port: number): Koa.Middleware {
    return async (ctx, next) => {
      if (ctx.respond === false || ctx.body != null) { await next(); return }
      if (ctx.path.startsWith('/gateway/')) { await next(); return }

      await new Promise<void>((resolve, reject) => {
        const req = http.request(
          { hostname: host, port, path: ctx.url, method: ctx.method, headers: { ...ctx.headers, host: `${host}:${port}` } },
          (res) => {
            ctx.status = res.statusCode || 502
            for (const [k, v] of Object.entries(res.headers)) { if (v) ctx.set(k, v as string) }
            ctx.body = res
            resolve()
          }
        )
        req.on('error', () => reject())
        if (ctx.req.readable) ctx.req.pipe(req); else req.end()
      }).catch(async () => { await next() })
    }
  }

  private startServer(): void {
    this.httpServer = http.createServer(this.app.callback())
    this.httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') log.error(`Port ${PORT} in use`)
      else log.error('Server error:', err)
    })
    this.httpServer.listen(PORT, '127.0.0.1', () => {
      log.info(`HttpServer listening on http://127.0.0.1:${PORT}`)
    })
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) { resolve(); return }
      this.httpServer.close((err) => err ? reject(err) : resolve())
      if (typeof this.httpServer.closeAllConnections === 'function') this.httpServer.closeAllConnections()
    })
  }
}
