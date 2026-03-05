# 龙虾议事厅架构分析：飞书模式 vs 当前模式

## 用户的核心关注

> "模仿飞书的方式，把插件构建到镜像里，启动时自动配置，让龙虾保持主动性"

---

## 📊 当前模式 vs 飞书模式对比

### 当前模式（被动推送）

```
[架构]
用户 → 前端 → HubServer → WebSocket 推送 → 龙虾 Gateway
                                              ↓
                                         龙虾被动接收
                                              ↓
                                      lobster_chat 工具回复
                                              ↓
                                         HubServer ← HTTP POST

[问题]
❌ 龙虾不知道"议事厅"的存在
❌ 龙虾是被动接收推送的消息
❌ 龙虾无法主动查看议事厅历史消息
❌ 龙虾无法主动发起讨论
❌ 插件需要手动配置（在 openclaw.json 中）
```

### 飞书模式（主动连接 Channel）

```
[架构]
龙虾 Gateway 启动
    ↓
自动连接到飞书 Channel（通过 channels.feishu 配置）
    ↓
飞书 SDK 通过 WebSocket 长连接监听飞书服务器
    ↓
飞书群有新消息 → 飞书 SDK 推送 → Gateway → 龙虾处理
    ↓
龙虾决定回复 → Gateway → 飞书 SDK → 飞书服务器 → 飞书群

[优势]
✅ 龙虾"知道"自己在飞书群里
✅ 龙虾主动监听群消息
✅ 龙虾可以主动发言
✅ 插件内置在 OpenClaw 镜像中
✅ 只需配置 channels.feishu，启动时自动激活
```

---

## 🎯 理想的"龙虾议事厅"架构

### 方案 A：作为内部 Channel（模仿飞书）

```
[架构设计]
1. 创建 @openclaw/lobster-hub-channel 插件
   - 实现 ChannelPlugin 接口
   - 注册为内置 Channel

2. 龙虾启动时自动连接
   openclaw.json:
   {
     "channels": {
       "lobster-hub": {
         "enabled": true,
         "hubUrl": "ws://host.docker.internal:8765/ws",
         "groups": {
           "lobby-1": { "enabled": true },
           "lobby-2": { "enabled": true }
         }
       }
     }
   }

3. 消息流
   用户发消息 → HubServer
              ↓
   HubServer 广播到 lobster-hub WebSocket
              ↓
   龙虾 Gateway 收到 Channel 事件
              ↓
   龙虾主动处理（就像处理飞书消息一样）
              ↓
   龙虾回复通过 Channel outbound 发送
              ↓
   HubServer 接收并广播

[优势]
✅ 龙虾"知道"议事厅的存在
✅ 龙虾主动连接并监听
✅ 符合 OpenClaw 的 Channel 设计模式
✅ 可以复用 OpenClaw 的群组管理、权限控制等功能
✅ 龙虾可以主动发起对话

[挑战]
⚠️ 需要实现完整的 ChannelPlugin 接口（~500 行代码）
⚠️ 需要在 Electron 主进程中实现 WebSocket 服务端
⚠️ 需要处理 Channel 的生命周期管理
```

### 方案 B：扩展现有 lobster_chat 工具（当前方案优化版）

```
[优化方向]
1. 把 lobster 插件预装到 Docker 镜像
   - 修改 Dockerfile，COPY extensions/lobster 到镜像
   - 启动时自动加载

2. 自动配置
   openclaw.json 自动包含：
   {
     "plugins": {
       "entries": {
         "lobster": { "enabled": true }
       }
     },
     "lobster": {
       "hubUrl": "http://host.docker.internal:8765",
       "autoConnect": true,
       "lobbies": ["lobby-1", "lobby-2"]
     }
   }

3. 增强 lobster 工具
   - lobster_list_lobbies: 查看所有议事厅
   - lobster_read_messages: 读取历史消息
   - lobster_send_message: 主动发送消息
   - lobster_join_lobby: 加入议事厅
   - lobster_leave_lobby: 离开议事厅

4. 定时轮询机制
   龙虾可以定时调用 lobster_read_messages 主动获取新消息
   
[优势]
✅ 改动较小，基于现有代码
✅ 不需要实现复杂的 ChannelPlugin
✅ 可以快速上线

[劣势]
❌ 龙虾仍然需要"主动"调用工具才能获取消息
❌ 不如 Channel 模式自然
❌ 需要额外的轮询逻辑
```

---

## 🏗️ 推荐方案：Channel 模式（方案 A）

### 为什么选择 Channel 模式？

1. **符合 OpenClaw 设计哲学**
   - 飞书、Slack、Discord 都是 Channel
   - 龙虾议事厅本质上也是一个消息渠道
   - 使用 Channel 模式最"正宗"

2. **龙虾的主动性**
   - 龙虾启动时主动连接议事厅
   - 龙虾主动监听议事厅消息
   - 龙虾可以主动发起讨论

3. **可扩展性**
   - 可以复用 OpenClaw 的群组管理
   - 可以添加权限控制
   - 可以支持多个议事厅

4. **用户体验**
   - 配置简单（只需在 channels 中配置）
   - 行为一致（和飞书、Slack 一样）

---

## 🚀 实施计划

### 阶段 1：创建 lobster-hub Channel Plugin

```typescript
// extensions/lobster-hub/src/channel.ts
export const lobsterHubPlugin: ChannelPlugin = {
  id: 'lobster-hub',
  meta: {
    id: 'lobster-hub',
    label: 'Lobster Hub',
    docsPath: '/channels/lobster-hub',
    blurb: '龙虾军团内部议事厅'
  },
  
  // 启动时连接到 HubServer
  startup: async ({ cfg, api }) => {
    const config = cfg.channels?.['lobster-hub']
    if (!config?.enabled) return
    
    const ws = new WebSocket(config.hubUrl)
    
    ws.on('message', (data) => {
      const event = JSON.parse(data.toString())
      // 将消息转换为 OpenClaw 的 inbound 格式
      api.dispatchInbound({
        channel: 'lobster-hub',
        peer: { kind: 'group', id: event.lobbyId },
        sender: { id: event.senderId, name: event.senderName },
        text: event.content,
        timestamp: event.timestamp
      })
    })
  },
  
  // 发送消息
  outbound: {
    send: async ({ text, target, cfg }) => {
      await fetch(`${cfg.channels['lobster-hub'].hubUrl}/api/hub/messages`, {
        method: 'POST',
        body: JSON.stringify({
          role: 'master', // or worker/qa
          senderId: process.env.AGENT_ID,
          senderName: process.env.AGENT_NAME,
          groupId: target.id,
          content: text
        })
      })
    }
  }
}
```

### 阶段 2：修改 Dockerfile

```dockerfile
# 在 OpenClaw 镜像中预装 lobster-hub 插件
COPY extensions/lobster-hub /app/extensions/lobster-hub

# 或者在 agent-openclaws 项目中：
# 构建自定义镜像时 COPY lobster-hub 插件
```

### 阶段 3：自动配置

```typescript
// agent-manager.ts
function generateOpenClawJson(opts) {
  return {
    plugins: {
      entries: {
        lobster: { enabled: true }  // 保留原有的 lobster 工具
      }
    },
    channels: {
      'lobster-hub': {
        enabled: true,
        hubUrl: 'ws://host.docker.internal:8765/ws',  // WebSocket 端点
        groups: opts.lobbies.map(id => ({
          [id]: { enabled: true }
        }))
      }
    }
  }
}
```

### 阶段 4：HubServer 支持 WebSocket 广播

```typescript
// hubServer.ts
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ noServer: true })

// 升级 HTTP 到 WebSocket
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  }
})

// 新消息时广播给所有连接的龙虾
function broadcastMessage(message: HubMessage) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message))
    }
  })
}
```

---

## 📋 对比总结

| 维度 | 当前模式 | 方案 B（工具增强） | 方案 A（Channel 模式） |
|------|---------|------------------|---------------------|
| **龙虾主动性** | ❌ 被动接收 | ⚠️ 需主动调用工具 | ✅ 主动监听 |
| **是否"正宗"** | ❌ 不符合 OpenClaw 模式 | ⚠️ 勉强可以 | ✅ 完全符合 |
| **实现复杂度** | ✅ 简单（已完成） | ⚠️ 中等 | ❌ 较复杂 |
| **可扩展性** | ❌ 有限 | ⚠️ 中等 | ✅ 强大 |
| **用户体验** | ⚠️ 需要理解特殊逻辑 | ⚠️ 需要理解工具 | ✅ 和飞书一样自然 |
| **插件预装** | ✅ 已支持 | ✅ 已支持 | ⚠️ 需要自定义镜像 |

---

## 🎯 最终建议

### 短期（1-2 天）：修复当前模式，保持可用

1. ✅ 修复 WebSocket 连接协议（已完成）
2. ✅ 添加环境变量（已完成）
3. ✅ 测试消息收发

### 中期（1-2 周）：实现 Channel 模式

1. 创建 `lobster-hub` Channel Plugin
2. 修改 HubServer 支持 WebSocket 广播
3. 修改 Dockerfile 预装插件
4. 自动配置龙虾连接到 lobster-hub Channel
5. 完整测试

### 长期（1 个月+）：增强功能

1. 群组权限管理
2. 消息历史查询
3. 在线状态显示
4. 消息已读/未读
5. @提及特定龙虾

---

## 💬 回答用户的问题

> "我们是不是应该模仿飞书的方式？"

**是的！** 飞书作为 Channel Plugin 的架构是最"正宗"的，应该模仿。

> "把插件构建到镜像里是不是最好？"

**是的！** lobster-hub 应该作为内置 Channel 预装到镜像，启动时自动激活。

> "启动后自动配置上去？"

**是的！** 通过 `openclaw.json` 中的 `channels.lobster-hub` 配置，Gateway 启动时自动连接。

> "这样才能发挥龙虾的主动性？"

**完全正确！** Channel 模式让龙虾：
- ✅ 主动连接议事厅
- ✅ 主动监听消息
- ✅ 主动参与讨论
- ✅ 就像在真实的飞书群里一样

> "当前模式不标准？"

**确实！** 当前的推送模式是一个"临时方案"，Channel 模式才是"正宗"的 OpenClaw 集成方式。

---

## 🚀 下一步行动

**建议**：

1. **立即**：修复并测试当前模式（让它先能用）
2. **本周内**：开始设计 `lobster-hub` Channel Plugin
3. **下周**：实现 Channel 模式的核心功能
4. **两周内**：完成迁移和测试

这样既能保证当前系统可用，又能向"正宗"的架构演进。

---

**你的直觉是对的！飞书模式才是正确的方向。**
