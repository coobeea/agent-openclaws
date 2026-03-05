# 议事厅消息对接机制详解

## 📡 核心架构

议事厅的消息对接分为 **3 个关键通道**：

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   前端 UI   │ ←────→  │  HubServer  │  ←────→ │  龙虾容器   │
│ LobbyView   │  HTTP   │  Koa 服务   │ WebSocket│  OpenClaw   │
└─────────────┘         └─────────────┘         └─────────────┘
                              ↑
                              │ HTTP Webhook
                              │
                        ┌─────────────┐
                        │    Gitea    │
                        │   仓库服务   │
                        └─────────────┘
```

## 🔄 消息流转的 3 种场景

### 场景 1: 你（人类）发消息给龙虾

**步骤详解**：

```
1️⃣ 你在前端输入消息并点击发送
   ↓
2️⃣ LobbyView.vue 调用 sendMessage()
   ↓
3️⃣ 发送 HTTP POST 到 http://127.0.0.1:8765/api/hub/messages
   {
     role: 'human',
     senderId: 'human',
     senderName: '我',
     groupId: '1',  // 当前议事厅的 ID
     content: '大家进度怎么样了？'
   }
   ↓
4️⃣ HubServer 收到请求，调用 hubCore.addMessage()
   ↓
5️⃣ 消息保存到 chat_history.jsonl 文件
   ↓
6️⃣ HubServer 检查这是 human 消息，调用 syncToAgents()
   ↓
7️⃣ syncToAgents 做了这些事：
   - 查询 lobbies.jsonl，找到 groupId=1 的议事厅
   - 获取该议事厅的 members 列表，例如 ['human', '1', '2']
   - 过滤出龙虾成员（排除 'human'），得到 ['1', '2']
   - 查询这些龙虾是否正在运行（status='running'）
   ↓
8️⃣ 对每只运行中的龙虾，HubServer 充当 WebSocket 客户端：
   - 连接到龙虾的 Gateway：ws://127.0.0.1:18800/?token=xxx
   - 发送 RPC 请求：
     {
       type: 'req',
       method: 'chat.submit',
       params: { text: '【前端开发组 - 我】: 大家进度怎么样了？' }
     }
   - 龙虾的 OpenClaw 收到这条消息，开始思考并执行
   ↓
9️⃣ 前端的长轮询（每 2 秒）获取新消息，显示在聊天界面
```

**代码位置**：
- 前端：`src/renderer/src/views/LobbyView.vue` - `sendMessage()` 方法
- 后端：`src/main/server/hubServer.ts` - `POST /api/hub/messages` + `syncToAgents()`

---

### 场景 2: 龙虾回复消息到议事厅

**步骤详解**：

```
1️⃣ 龙虾在 OpenClaw 内部处理你的消息
   ↓
2️⃣ 龙虾思考后决定要回复，调用工具 lobster_chat
   参数: {
     groupId: '1',
     message: '前端页面已经完成 80%，预计明天完成',
     role: 'worker'
   }
   ↓
3️⃣ lobster_chat 工具（在龙虾容器内运行）
   位置: /Users/lifeng/git/git_agents/openclaw/extensions/lobster/src/chat-tool.ts
   ↓
4️⃣ 工具从环境变量获取身份信息：
   - AGENT_NAME: 'worker-001' (龙虾名字)
   - AGENT_ID: '1' (龙虾 ID)
   - LOBSTER_HUB_URL: 'http://host.docker.internal:8765/api/hub/messages'
   ↓
5️⃣ 工具发送 HTTP POST 到宿主机的 HubServer
   使用 host.docker.internal (Docker 的特殊域名，指向宿主机)
   {
     role: 'worker',
     senderId: '1',
     senderName: 'worker-001',
     groupId: '1',
     content: '前端页面已经完成 80%，预计明天完成'
   }
   ↓
6️⃣ HubServer 收到消息，保存到 chat_history.jsonl
   ↓
7️⃣ 因为是龙虾发的消息（role='worker'），不会再次同步给龙虾
   （避免死循环）
   ↓
8️⃣ 前端长轮询获取新消息，显示龙虾的回复
```

**关键代码**：

龙虾容器启动时注入的环境变量：
```typescript:130:140:/Users/lifeng/git/git-claw/agent-openclaws/src/main/services/agent-manager.ts
      const env: Record<string, string> = {
        OPENCLAW_GATEWAY_TOKEN: token,
        GITEA_URL: giteaUrl.replace('localhost', 'host.docker.internal'),
        GITEA_TOKEN: giteaToken,
        AGENT_NAME: agent.name,
        AGENT_ID: agent.id.toString(),
      }

      const info = await dockerManager.createOpenClawContainer(agent.name, port, ws, env)
      await dockerManager.startContainer(info.fullId)
      return agents.update(id, { status: 'running', container_id: info.fullId, gateway_port: port, gateway_token: token })!
```

龙虾的 `lobster_chat` 工具实现：

```typescript:24:40:/Users/lifeng/git/git_agents/openclaw/extensions/lobster/src/chat-tool.ts
      // Read agent name from env or fallback
      const senderName = process.env.AGENT_NAME || 'OpenClaw Agent';
      const senderId = process.env.AGENT_ID || senderName;

      return new Promise<{content: any[]}>((resolve, reject) => {
        const postData = JSON.stringify({
          role,
          senderId,
          senderName,
          groupId,
          content: message
        });

        // The HubServer is typically reachable on the docker host via host.docker.internal:8765 
        // We can pass the hub URL via environment variable LOBSTER_HUB_URL
        const hubUrl = process.env.LOBSTER_HUB_URL || 'http://host.docker.internal:8765/api/hub/messages';
        const parsedUrl = new URL(hubUrl);
```

---

### 场景 3: Gitea 事件自动广播到议事厅

**步骤详解**：

```
1️⃣ 在 Gitea 仓库中发生事件（创建 Issue、提交 PR 等）
   ↓
2️⃣ Gitea 触发 Webhook，发送 POST 请求
   URL: http://host.docker.internal:8765/api/hub/webhook/gitea
   Headers: { 'x-gitea-event': 'issues' }
   Body: { action: 'opened', issue: {...}, repository: {...} }
   ↓
3️⃣ HubServer 的 Webhook 端点处理请求
   位置: src/main/server/hubServer.ts - POST /api/hub/webhook/gitea
   ↓
4️⃣ 根据事件类型生成系统消息：
   例: "【Gitea 广播 - Issue opened】新的 Issue #42 '实现用户登录功能' 已创建"
   ↓
5️⃣ 系统消息发送到指定的 groupId（默认 'global'）
   {
     role: 'system',
     senderId: 'gitea',
     senderName: 'Gitea',
     groupId: 'global',
     content: '【Gitea 广播 - Issue opened】...'
   }
   ↓
6️⃣ HubServer 调用 syncToAgents()，推送给所有运行中的龙虾
   ↓
7️⃣ 前端长轮询获取新消息，显示系统通知
```

**Webhook 配置**：
```
URL: http://host.docker.internal:8765/api/hub/webhook/gitea
Content Type: application/json
Events: Issues, Pull Requests, Issue Comments
```

---

## 🔍 关键技术点

### 1. 跨 Docker 容器通信

**问题**: 龙虾在 Docker 容器内，如何访问宿主机的 HubServer？

**解决方案**: 使用 Docker 的特殊域名 `host.docker.internal`

```typescript
// 龙虾容器内
const hubUrl = 'http://host.docker.internal:8765/api/hub/messages'
// 等价于宿主机的 http://127.0.0.1:8765/api/hub/messages
```

### 2. 双向消息同步

**人类 → 龙虾**: HubServer 作为 WebSocket **客户端** 连接龙虾的 Gateway

```typescript:128:145:/Users/lifeng/git/git-claw/agent-openclaws/src/main/server/hubServer.ts
    for (const agent of agents) {
      try {
        const wsUrl = `ws://127.0.0.1:${agent.gateway_port}/?token=${agent.gateway_token}`
        const ws = new WebSocket(wsUrl)
        
        ws.on('open', () => {
          // 构造群聊提示前缀，让大模型知道这是来自哪个议事厅的某人发言
          const text = `【${lobby.name} - ${message.senderName}】: ${message.content}`
          const req = {
            type: 'req',
            id: Math.random().toString(36).substring(2),
            method: 'chat.submit',
            params: { text }
          }
          ws.send(JSON.stringify(req))
          
          // 发送完毕后稍微等一下关掉（龙虾内部自己思考，如果它有话要说，它会通过 lobster_chat 工具调回来）
          setTimeout(() => ws.close(), 1000)
        })
```

**龙虾 → HubServer**: 龙虾调用 `lobster_chat` 工具，发送 HTTP POST

```typescript:42:51:/Users/lifeng/git/git_agents/openclaw/extensions/lobster/src/chat-tool.ts
        const req = http.request({
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        }, (res) => {
```

### 3. 群组隔离

**问题**: 如何确保消息只发送给特定议事厅的成员？

**解决方案**: 
- 每条消息都有 `groupId` 字段
- `syncToAgents()` 只推送给该群组的成员

```typescript:112:126:/Users/lifeng/git/git-claw/agent-openclaws/src/main/server/hubServer.ts
  private async syncToAgents(message: HubMessage) {
    // 获取该群组的成员列表
    const lobby = this.getLobby(message.groupId)
    if (!lobby) {
      log.warn(`[LobsterHub] Lobby ${message.groupId} not found, skipping sync`)
      return
    }

    // 只同步给该群组的龙虾成员（排除 'human'）
    const memberAgentIds = lobby.members.filter(m => m !== 'human')
    const agents = agentManager.list().filter(a => 
      memberAgentIds.includes(a.id.toString()) && 
      a.status === 'running' && 
      a.gateway_port
    )
```

### 4. 前端实时更新

**问题**: 前端如何实时获取新消息？

**解决方案**: 长轮询（Long Polling）

```typescript
// LobbyView.vue
const fetchMessages = async () => {
  if (!selectedLobby.value) return
  try {
    // 获取自上次时间戳之后的新消息
    const res = await fetch(
      `http://127.0.0.1:8765/api/hub/poll?groupId=${selectedLobby.value.id}&since=${lastTimestamp}`
    )
    const json = await res.json()
    if (json.ok && json.data.length > 0) {
      messages.value.push(...json.data)
      lastTimestamp = json.data[json.data.length - 1].timestamp
      scrollToBottom()
    }
  } catch (err) {
    console.error('Failed to fetch hub messages:', err)
  }
}

// 每 2 秒轮询一次
const startPolling = () => {
  const poll = async () => {
    await fetchMessages()
    pollTimer = window.setTimeout(poll, 2000)
  }
  poll()
}
```

---

## 🎬 完整案例演示

### 案例：主龙虾和工龙虾协作

**场景**: 你创建了 `前端开发组` 议事厅，邀请了 `master-001` 和 `worker-001`。

#### 第 1 步：你发起讨论

1. 你在前端输入："@所有人，需要实现用户登录功能"
2. 点击发送

**后台发生的事**：
```
→ 消息保存到 chat_history.jsonl:
  {id: 1, role: 'human', groupId: '1', content: '@所有人，需要实现用户登录功能'}

→ HubServer 连接到 master-001 的 Gateway (ws://127.0.0.1:18800)
  发送 RPC: chat.submit("【前端开发组 - 我】: @所有人，需要实现用户登录功能")

→ HubServer 连接到 worker-001 的 Gateway (ws://127.0.0.1:18801)
  发送 RPC: chat.submit("【前端开发组 - 我】: @所有人，需要实现用户登录功能")
```

#### 第 2 步：主龙虾收到消息并拆解任务

1. `master-001` 的 OpenClaw 收到你的消息
2. AI 思考："需要拆解这个需求"
3. 主龙虾调用工具 `lobster_chat`：
   ```json
   {
     "groupId": "1",
     "message": "收到！我将这个需求拆解为 3 个任务：\n1. 设计登录表单 UI\n2. 实现后端登录 API\n3. 集成前后端",
     "role": "master"
   }
   ```
4. `lobster_chat` 工具发送 HTTP POST 到 `http://host.docker.internal:8765/api/hub/messages`

**后台发生的事**：
```
→ 消息到达 HubServer
→ 保存到 chat_history.jsonl:
  {id: 2, role: 'master', senderId: '1', senderName: 'master-001', groupId: '1', content: '收到！...'}

→ 因为是龙虾发的，不会再次同步（避免循环）

→ 前端长轮询获取到新消息
→ 显示在聊天界面，头像显示黄色皇冠图标
```

#### 第 3 步：工龙虾回应领取任务

1. `worker-001` 看到主龙虾的拆解消息
2. 决定领取任务 1
3. 调用 `lobster_chat` 工具：
   ```json
   {
     "groupId": "1",
     "message": "我来做任务 1 - 设计登录表单 UI",
     "role": "worker"
   }
   ```

**后台发生的事**：
```
→ 消息到达 HubServer
→ 保存并显示在前端
→ 头像显示蓝色机器人图标
```

---

## 🏗️ 数据持久化

所有消息和议事厅数据都保存在 JSONL 文件中：

### 消息存储 (chat_history.jsonl)
```
/Users/lifeng/Library/Application Support/openclaws/data/chat_history.jsonl
```

每行一条消息：
```json
{"id":1,"timestamp":1709594399274,"role":"human","senderId":"human","senderName":"我","groupId":"1","content":"大家进度怎么样了？"}
{"id":2,"timestamp":1709594402156,"role":"master","senderId":"1","senderName":"master-001","groupId":"1","content":"收到！我将这个需求拆解为..."}
```

### 议事厅存储 (lobbies.jsonl)
```
/Users/lifeng/Library/Application Support/openclaws/data/lobbies.jsonl
```

每行一个议事厅：
```json
{"id":1,"name":"前端开发组","description":"负责前端相关任务","members":["human","1","2"],"created_at":"2026-03-04T22:49:59.274Z","updated_at":"2026-03-04T22:49:59.274Z"}
```

---

## 🔐 安全与权限

### 龙虾身份验证

每只龙虾都有独立的 Gateway Token，HubServer 连接时必须携带：

```typescript
const wsUrl = `ws://127.0.0.1:${agent.gateway_port}/?token=${agent.gateway_token}`
```

### 消息隔离

- 消息按 `groupId` 隔离
- 龙虾只能看到自己加入的议事厅的消息
- 前端只显示当前选中议事厅的消息

---

## 🐛 调试技巧

### 查看消息流转日志

在应用终端可以看到所有消息事件：

```
[OpenClaws] [LobsterHub] New message in 1 from 我: 大家进度怎么样了？
[OpenClaws] [LobsterHub] Syncing message to 2 agents
[OpenClaws] [LobsterHub] New message in 1 from master-001: 收到！我将这个需求拆解为...
```

### 手动测试消息发送

```bash
# 模拟人类发消息
curl -X POST http://127.0.0.1:8765/api/hub/messages \
  -H "Content-Type: application/json" \
  -d '{
    "role": "human",
    "senderId": "human",
    "senderName": "测试用户",
    "groupId": "1",
    "content": "测试消息"
  }'

# 查看消息列表
curl http://127.0.0.1:8765/api/hub/messages?groupId=1
```

### 查看龙虾是否收到消息

1. 打开龙虾的控制面板（点击"控制面板"按钮）
2. 在 Chat 界面查看是否收到你的消息
3. 如果没收到，检查：
   - 龙虾是否处于"运行中"状态
   - 龙虾是否是该议事厅的成员
   - 查看应用终端是否有 WebSocket 错误

---

## 📊 技术架构图

```
┌───────────────────────────────────────────────────────────────┐
│                        前端 (Vue3)                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  LobbyView.vue                                           │  │
│  │  • 用户输入消息                                            │  │
│  │  • 长轮询获取新消息 (每 2 秒)                              │  │
│  │  • 显示不同角色的头像和颜色                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────┬──────────────────────────────────────────┘
                     │ HTTP POST/GET
                     │ http://127.0.0.1:8765
                     ↓
┌───────────────────────────────────────────────────────────────┐
│              Electron 主进程 (Koa Server)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  hubServer.ts (LobsterHub)                               │  │
│  │  • POST /api/hub/messages - 接收消息                      │  │
│  │  • GET /api/hub/poll - 长轮询新消息                       │  │
│  │  • POST /api/hub/webhook/gitea - Gitea 事件              │  │
│  │  • CRUD /api/hub/lobbies - 议事厅管理                     │  │
│  │  • 消息保存到 chat_history.jsonl                          │  │
│  │  • 议事厅保存到 lobbies.jsonl                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────┬──────────────────────────────────────────┘
                     │ WebSocket 客户端 (人类消息推送)
                     │ ws://127.0.0.1:18800/?token=xxx
                     ↓
┌───────────────────────────────────────────────────────────────┐
│                   Docker 容器 (龙虾)                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  OpenClaw Gateway (WebSocket 服务端)                     │  │
│  │  • 接收 HubServer 推送的人类消息                           │  │
│  │  • 处理 chat.submit RPC 请求                              │  │
│  │  • 触发 AI 思考和回复                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  lobster_chat 工具 (OpenClaw 插件)                       │  │
│  │  • 龙虾主动调用此工具发消息                                │  │
│  │  • 发送 HTTP POST 到 host.docker.internal:8765           │  │
│  │  • 环境变量: AGENT_NAME, AGENT_ID, LOBSTER_HUB_URL       │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 💡 关键要点总结

1. **HubServer 是消息中枢**: 所有消息都经过它中转和存储
2. **双向通信**:
   - **推**: HubServer 主动推送人类消息给龙虾（WebSocket 客户端）
   - **拉**: 龙虾主动发消息到 HubServer（HTTP POST）
3. **群组隔离**: 通过 `groupId` + `members` 列表控制消息可见性
4. **跨容器通信**: 使用 `host.docker.internal` 域名
5. **数据持久化**: JSONL 文件存储，重启不丢失
6. **实时同步**: 前端长轮询 + 后端 EventEmitter

---

## 🎯 验证方法

### 快速验证消息对接是否工作

1. **创建一只龙虾并启动**（智能体管理页面）
2. **创建一个议事厅并邀请该龙虾**（议事厅页面）
3. **发送一条测试消息**："你好，收到请回复"
4. **观察应用终端日志**：
   ```
   [OpenClaws] [LobsterHub] New message in 1 from 我: 你好，收到请回复
   [OpenClaws] [LobsterHub] Syncing message to 1 agents
   ```
5. **打开龙虾的控制面板**（点击智能体卡片的"控制面板"按钮）
6. **在龙虾的 Chat 界面查看**：应该能看到"【前端开发组 - 我】: 你好，收到请回复"
7. **等待龙虾回复**：龙虾会自动调用 `lobster_chat` 工具，消息会出现在议事厅

---

**现在你明白消息是如何对接的了吗？** 😊

简单来说：
- 你的消息 → HubServer → **主动推送**给龙虾的 Gateway
- 龙虾的回复 → `lobster_chat` 工具 → **主动发送**到 HubServer → 你在前端看到

这是一个 **双向主动** 的消息机制，而不是传统的发布-订阅模式！
