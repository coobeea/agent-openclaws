import Router from '@koa/router'
import { log } from '@main/utils/logger'
import { EventEmitter } from 'events'
import { agentManager } from '../services/agent-manager'
import { JsonlCollection } from '../services/jsonl-store'
import WebSocket from 'ws'
import { WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'
import type http from 'http'

export interface HubMessage {
  id: number
  timestamp: number
  role: 'human' | 'master' | 'worker' | 'qa' | 'system'
  senderId: string // agent id or 'human' or 'system'
  senderName: string
  groupId: string // The lobby/group id this message belongs to
  content: string
}

export interface Lobby {
  id: string
  name: string
  description: string
  members: string[] // Array of agent IDs (e.g., ['1', '2', 'human'])
  created_at: string
  updated_at: string
}

class LobsterHub extends EventEmitter {
  private messagesStore = new JsonlCollection<HubMessage>('chat_history.jsonl')
  private lobbiesStore = new JsonlCollection<Lobby>('lobbies.jsonl')
  private wss: WebSocketServer | null = null
  private connectedAgents = new Map<string, { ws: WebSocket; agentId: string; agentName: string; lobbies: string[] }>()
  
  // Keep an in-memory cache for fast polling/getting
  private get messages(): HubMessage[] {
    return this.messagesStore.all()
  }

  // Lobby management
  createLobby(name: string, description: string, members: string[] = []): Lobby {
    const now = new Date().toISOString()
    const lobby: Omit<Lobby, 'id'> = {
      name,
      description,
      members: ['human', ...members], // Always include human
      created_at: now,
      updated_at: now
    } as any
    return this.lobbiesStore.insert(lobby) as Lobby
  }

  listLobbies(): Lobby[] {
    return this.lobbiesStore.all()
  }

  getLobby(id: string | number): Lobby | undefined {
    const idStr = id.toString()
    return this.lobbiesStore.all().find(l => l.id.toString() === idStr)
  }

  updateLobby(id: string | number, changes: Partial<Lobby>): Lobby | undefined {
    const idStr = id.toString()
    const lobby = this.lobbiesStore.all().find(l => l.id.toString() === idStr)
    if (!lobby) return undefined
    return this.lobbiesStore.update(lobby.id as any, { ...changes, updated_at: new Date().toISOString() })
  }

  deleteLobby(id: string | number): boolean {
    const idStr = id.toString()
    const lobby = this.lobbiesStore.all().find(l => l.id.toString() === idStr)
    if (!lobby) return false
    return this.lobbiesStore.delete(lobby.id as any)
  }

  addMember(lobbyId: string | number, agentId: string): boolean {
    const lobby = this.getLobby(lobbyId)
    if (!lobby) return false
    if (lobby.members.includes(agentId)) return true
    lobby.members.push(agentId)
    this.updateLobby(lobbyId, { members: lobby.members })
    return true
  }

  removeMember(lobbyId: string | number, agentId: string): boolean {
    const lobby = this.getLobby(lobbyId)
    if (!lobby) return false
    lobby.members = lobby.members.filter(m => m !== agentId)
    this.updateLobby(lobbyId, { members: lobby.members })
    return true
  }

  // Add a message and broadcast it
  addMessage(msg: Omit<HubMessage, 'id' | 'timestamp'>) {
    const timestamp = Date.now()
    const inserted = this.messagesStore.insert({
      ...msg,
      timestamp
    } as any) as HubMessage

    const message = { ...inserted, timestamp } // ensure timestamp is set as we passed it

    log.info(`[LobsterHub] New message in ${message.groupId} from ${message.senderName}: ${message.content.substring(0, 50)}`)
    this.emit('message', message)
    
    // 广播给所有连接的龙虾
    this.broadcastMessage(message)
    
    return message
  }

  getMessages(groupId: string | number, limit = 50) {
    const groupIdStr = groupId.toString()
    return this.messages.filter(m => m.groupId.toString() === groupIdStr).slice(-limit)
  }

  // WebSocket Server for Channel Plugin
  initWebSocketServer(server: http.Server) {
    this.wss = new WebSocketServer({ noServer: true })

    server.on('upgrade', (req: IncomingMessage, socket: any, head: Buffer) => {
      if (req.url === '/api/hub/ws') {
        this.wss!.handleUpgrade(req, socket, head, (ws) => {
          this.wss!.emit('connection', ws, req)
        })
      }
    })

    this.wss.on('connection', (ws: WebSocket) => {
      log.info('[LobsterHub] Agent connected via WebSocket')

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'subscribe') {
            this.connectedAgents.set(msg.agentId, {
              ws,
              agentId: msg.agentId,
              agentName: msg.agentName,
              lobbies: msg.lobbies || [],
            })
            log.info(`[LobsterHub] Agent ${msg.agentName} (id=${msg.agentId}) subscribed to lobbies: ${msg.lobbies.join(', ')}`)
          }
        } catch (err: any) {
          log.error('[LobsterHub] Failed to parse WebSocket message:', err.message)
        }
      })

      ws.on('close', () => {
        for (const [agentId, conn] of this.connectedAgents.entries()) {
          if (conn.ws === ws) {
            this.connectedAgents.delete(agentId)
            log.info(`[LobsterHub] Agent ${conn.agentName} disconnected`)
            break
          }
        }
      })

      ws.on('error', (err) => {
        log.error('[LobsterHub] WebSocket error:', err)
      })
    })
  }

  broadcastMessage(message: HubMessage) {
    const lobby = this.getLobby(message.groupId)
    if (!lobby) {
      log.warn(`[LobsterHub] Lobby ${message.groupId} not found, skipping broadcast`)
      return
    }

    log.info(`[LobsterHub] Broadcasting message to lobby ${lobby.name} (${lobby.id})`)
    let broadcastCount = 0

    for (const [agentId, conn] of this.connectedAgents.entries()) {
      // 只广播给该 lobby 的成员
      if (lobby.members.includes(agentId) && conn.lobbies.includes(message.groupId.toString())) {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.send(JSON.stringify(message))
          broadcastCount++
          log.info(`[LobsterHub] Broadcasted to ${conn.agentName}`)
        }
      }
    }

    log.info(`[LobsterHub] Broadcast complete: ${broadcastCount} agents received the message`)
  }
}

export const hubCore = new LobsterHub()

// The HTTP router that OpenClaw extensions and our frontend will talk to
export const hubRouter = new Router({ prefix: '/api/hub' })

// ===== Lobby Management =====
hubRouter.get('/lobbies', (ctx) => {
  ctx.body = {
    ok: true,
    data: hubCore.listLobbies()
  }
})

hubRouter.post('/lobbies', (ctx) => {
  const body = ctx.request.body as any
  if (!body.name) {
    ctx.status = 400
    ctx.body = { ok: false, error: 'Missing required field: name' }
    return
  }
  const lobby = hubCore.createLobby(body.name, body.description || '', body.members || [])
  ctx.body = { ok: true, data: lobby }
})

hubRouter.get('/lobbies/:id', (ctx) => {
  const lobby = hubCore.getLobby(ctx.params.id)
  if (!lobby) {
    ctx.status = 404
    ctx.body = { ok: false, error: 'Lobby not found' }
    return
  }
  ctx.body = { ok: true, data: lobby }
})

hubRouter.patch('/lobbies/:id', (ctx) => {
  const body = ctx.request.body as any
  const lobby = hubCore.updateLobby(ctx.params.id, body)
  if (!lobby) {
    ctx.status = 404
    ctx.body = { ok: false, error: 'Lobby not found' }
    return
  }
  ctx.body = { ok: true, data: lobby }
})

hubRouter.delete('/lobbies/:id', (ctx) => {
  const ok = hubCore.deleteLobby(ctx.params.id)
  if (!ok) {
    ctx.status = 404
    ctx.body = { ok: false, error: 'Lobby not found' }
    return
  }
  ctx.body = { ok: true }
})

hubRouter.post('/lobbies/:id/members', (ctx) => {
  const body = ctx.request.body as any
  if (!body.agentId) {
    ctx.status = 400
    ctx.body = { ok: false, error: 'Missing agentId' }
    return
  }
  const ok = hubCore.addMember(ctx.params.id, body.agentId)
  if (!ok) {
    ctx.status = 404
    ctx.body = { ok: false, error: 'Lobby not found' }
    return
  }
  ctx.body = { ok: true }
})

hubRouter.delete('/lobbies/:id/members/:agentId', (ctx) => {
  const ok = hubCore.removeMember(ctx.params.id, ctx.params.agentId)
  if (!ok) {
    ctx.status = 404
    ctx.body = { ok: false, error: 'Lobby not found or member not in lobby' }
    return
  }
  ctx.body = { ok: true }
})

// ===== Messages =====
// OpenClaw agents or frontend fetch history
hubRouter.get('/messages', (ctx) => {
  const groupId = (ctx.query.groupId as string) || 'global'
  const limit = parseInt((ctx.query.limit as string) || '50', 10)
  ctx.body = {
    ok: true,
    data: hubCore.getMessages(groupId, limit)
  }
})

// OpenClaw agents or frontend send a message
hubRouter.post('/messages', (ctx) => {
  const body = ctx.request.body as any
  
  if (!body.content || !body.senderId || !body.senderName || !body.role) {
    ctx.status = 400
    ctx.body = { ok: false, error: 'Missing required fields' }
    return
  }

  const msg = hubCore.addMessage({
    role: body.role,
    senderId: body.senderId,
    senderName: body.senderName,
    groupId: body.groupId || 'global',
    content: body.content
  })

  ctx.body = { ok: true, data: msg }
})

// Webhook endpoint for Gitea to send issue/PR updates
hubRouter.post('/webhook/gitea', (ctx) => {
  const event = ctx.headers['x-gitea-event']
  const body = ctx.request.body as any

  let content = ''
  let groupId = 'global'

  if (body.repository && body.repository.name) {
    groupId = body.repository.name
  }

  if (event === 'issues') {
    const action = body.action
    const issue = body.issue
    content = `【Gitea 广播 - Issue ${action}】\n标题: ${issue.title}\n编号: #${issue.number}\n链接: ${issue.html_url}\n创建人: ${issue.user.login}`
  } else if (event === 'pull_request') {
    const action = body.action
    const pr = body.pull_request
    content = `【Gitea 广播 - PR ${action}】\n标题: ${pr.title}\n编号: #${pr.number}\n链接: ${pr.html_url}\n提交人: ${pr.user.login}`
  } else if (event === 'issue_comment') {
    const action = body.action
    const issue = body.issue
    const comment = body.comment
    content = `【Gitea 广播 - Issue 评论 ${action}】\nIssue: ${issue.title} (#${issue.number})\n评论人: ${comment.user.login}\n内容: ${comment.body}`
  }

  if (content) {
    hubCore.addMessage({
      role: 'system',
      senderId: 'gitea-webhook',
      senderName: 'Gitea 机器人',
      groupId: 'global', // Force global for now so everyone sees it, or change to use groupId
      content: content
    })
  }

  ctx.body = { ok: true }
})

// Polling endpoint for OpenClaw agents to get new messages (since they might not easily do WebSockets)
// In a real scenario, they would send a `last_id` or `since` timestamp.
hubRouter.get('/poll', async (ctx) => {
  const groupId = (ctx.query.groupId as string) || 'global'
  const since = parseInt((ctx.query.since as string) || '0', 10)
  
  // Simple long-polling simulation (wait up to 30s)
  const timeoutMs = 30000
  const checkInterval = 1000
  let elapsed = 0

  while (elapsed < timeoutMs) {
    const newMsgs = hubCore.getMessages(groupId, 100).filter(m => m.timestamp > since)
    if (newMsgs.length > 0) {
      ctx.body = { ok: true, data: newMsgs }
      return
    }
    await new Promise(resolve => setTimeout(resolve, checkInterval))
    elapsed += checkInterval
  }

  ctx.body = { ok: true, data: [] }
})

// Export function to initialize WebSocket server
export function initHubWebSocketServer(server: http.Server) {
  hubCore.initWebSocketServer(server)
}
