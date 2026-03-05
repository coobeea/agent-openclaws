# 龙虾议事厅调试指南

## 当前状态

已完成 Channel 模式实施的所有代码修改：

1. ✅ 创建 `lobster-hub` Channel Plugin（位于 `/Users/lifeng/git/git_agents/openclaw/extensions/lobster-hub/`）
2. ✅ HubServer 添加 WebSocket 服务器支持（在 `src/main/server/hubServer.ts`）
3. ✅ OpenClaw 配置生成添加 `channels.lobster-hub`（在 `src/main/templates/openclaw-config.ts`）
4. ✅ 应用启动时初始化 HubServer WebSocket（在 `src/main/app.ts`）

## 重要提示

**⚠️ 修改生效需要完全重启！**

修改后需要：
1. **停止 Electron 应用**（Ctrl+C）
2. **删除旧的龙虾容器**
3. **重新运行** `pnpm run dev`
4. **重新创建龙虾**以使用新配置

## 问题诊断

### 问题 1：前端消息不显示

**可能原因：**
- 轮询延迟（最多2秒）
- groupId 类型不匹配（已修复：统一使用字符串比较）

**排查步骤：**
1. 打开浏览器开发者工具 Console
2. 发送消息后检查是否有错误
3. 查看 Network 标签，确认 POST `/api/hub/messages` 返回成功
4. 检查 `/api/hub/messages?groupId=X` 能否返回消息

### 问题 2：龙虾不回复

**可能原因：**
- 龙虾容器使用旧配置（没有 `channels.lobster-hub`）
- OpenClaw 镜像中没有 `lobster-hub` 插件
- 龙虾没有连接到 WebSocket 服务器

**排查步骤：**
1. 查看 Electron 终端日志，确认：
   ```
   [LobsterHub] Agent connected via WebSocket
   [LobsterHub] Agent XXX subscribed to lobbies: ...
   ```
2. 查看 Docker 容器日志：
   ```bash
   docker logs <container_name>
   ```
   应该看到：
   ```
   [lobster-hub] Connected to HubServer
   [lobster-hub] Subscribing to lobbies: ...
   ```
3. 检查龙虾的 `openclaw.json` 配置：
   ```bash
   cat ~/Library/Application\ Support/openclaws/workspaces/<龙虾名>/.openclaw/openclaw.json
   ```
   应该包含：
   ```json
   {
     "channels": {
       "lobster-hub": {
         "enabled": true,
         "hubUrl": "ws://host.docker.internal:8765/ws",
         "lobbies": { "1": { "enabled": true } }
       }
     }
   }
   ```

### 问题 3：WebSocket 连接失败

**可能原因：**
- HubServer WebSocket 未初始化
- 端口冲突
- Docker 网络问题

**排查步骤：**
1. 确认 Electron 启动日志中有：
   ```
   [OpenClaws] HubServer WebSocket initialized
   ```
2. 测试 WebSocket 连接：
   ```bash
   wscat -c ws://127.0.0.1:8765/ws
   # 连接后发送：
   {"type":"subscribe","agentId":"test","agentName":"Test","lobbies":["1"]}
   ```

## 完整重启流程

```bash
# 1. 停止应用
Ctrl+C（在运行 pnpm run dev 的终端）

# 2. 删除旧的龙虾容器（可选但推荐）
docker ps -a | grep openclaws | awk '{print $1}' | xargs docker rm -f

# 3. 重新构建 OpenClaw 镜像（如果修改了 extensions/lobster-hub/）
cd /Users/lifeng/git/git_agents/openclaw
pnpm build
docker build -t openclaw:local .

# 4. 重新启动 Electron 应用
cd /Users/lifeng/git/git-claw/agent-openclaws
pnpm run dev

# 5. 在 UI 中重新创建龙虾或重启现有龙虾
```

## 测试步骤

### 手动测试

1. **创建议事厅**
   - 打开龙虾议事厅页面
   - 点击"创建议事厅"
   - 输入名称，选择至少一只龙虾
   - 点击创建

2. **确保龙虾正在运行**
   - 进入"龙虾管理"页面
   - 启动选中的龙虾
   - 等待状态变为"running"

3. **发送消息**
   - 回到议事厅页面
   - 选择刚创建的议事厅
   - 发送一条消息
   - 等待2-5秒

4. **检查结果**
   - 你的消息应该立即显示
   - 龙虾的回复应该在几秒后出现

### 自动化测试

运行测试脚本：
```bash
node /Users/lifeng/git/git-claw/agent-openclaws/test-lobby-integration.js
```

## 日志关键字

### 正常运行的日志

**Electron 应用：**
```
[OpenClaws] HttpServer listening on http://127.0.0.1:8765
[OpenClaws] HubServer WebSocket initialized
[LobsterHub] Agent connected via WebSocket
[LobsterHub] Agent master-001 (id=1) subscribed to lobbies: 1, 2
[LobsterHub] New message in 1 from 我: 测试消息
[LobsterHub] Broadcasting message to lobby 前端开发组 (1)
[LobsterHub] Broadcasted to master-001
[LobsterHub] Broadcast complete: 1 agents received the message
```

**Docker 容器（龙虾）：**
```
[lobster-hub] Connected to HubServer
[lobster-hub] Subscribing to lobbies: 1
[lobster-hub] Received message from 我 in lobby 1
```

### 错误日志

**缺少 WebSocket 初始化：**
```
[OpenClaws] HttpServer listening on http://127.0.0.1:8765
# 缺少: [OpenClaws] HubServer WebSocket initialized
```
**解决方案：**检查 `src/main/app.ts` 中的 `initHubWebSocketServer` 调用

**Lobby 未找到：**
```
[LobsterHub] Lobby 4 not found, skipping broadcast
```
**解决方案：**groupId 不匹配，检查前端发送的 groupId 与实际 Lobby ID

**没有龙虾连接：**
```
[LobsterHub] Broadcasting message to lobby 前端开发组 (1)
[LobsterHub] Broadcast complete: 0 agents received the message
```
**解决方案：**龙虾未启动或未连接 WebSocket，检查容器状态和日志

## 常见问题

### Q: 前端一直显示"暂无消息"

**A:** 
1. 检查浏览器 Console 是否有错误
2. 手动访问 `http://127.0.0.1:8765/api/hub/messages?groupId=1`
3. 确认返回的消息中 `groupId` 与当前选中的 Lobby ID 匹配
4. 检查 `currentMessages` computed 的过滤逻辑

### Q: 龙虾收到消息但不回复

**A:**
1. 检查龙虾的 AI 模型配置是否正确
2. 查看容器日志中的 AI 调用错误
3. 确认 OpenClaw 的 `agents.defaults.model` 配置正确
4. 检查 API Key 是否有效

### Q: WebSocket 连接被拒绝

**A:**
1. 确认 HubServer 已启动（端口 8765）
2. 检查防火墙设置
3. 对于 Docker 容器，确认使用 `host.docker.internal:8765`
4. 测试从主机连接：`wscat -c ws://127.0.0.1:8765/ws`

### Q: Docker 容器中找不到 lobster-hub 插件

**A:**
1. 检查 OpenClaw 源码目录中是否存在 `extensions/lobster-hub/`
2. 重新构建 OpenClaw 镜像：
   ```bash
   cd /Users/lifeng/git/git_agents/openclaw
   docker build -t openclaw:local .
   ```
3. 删除旧容器并重新创建龙虾

## 架构图

```
┌─────────────────────┐
│   前端 LobbyView    │
│  (HTTP + 轮询2s)    │
└──────────┬──────────┘
           │ POST /api/hub/messages
           ↓
┌─────────────────────┐
│   HubServer (Koa)   │
│  + WebSocket (/ws)  │
└──────┬──────────────┘
       │ WebSocket 广播
       ↓
┌─────────────────────┐
│ Docker 容器（龙虾）  │
│  lobster-hub Plugin │
│  Channel Inbound    │
└──────┬──────────────┘
       │ AI 处理
       ↓
┌─────────────────────┐
│   Channel Outbound  │
│ POST /api/hub/messages
└─────────────────────┘
       │
       ↓ (循环回 HubServer)
```

## 下一步

如果所有排查都正常但仍有问题，请提供：
1. Electron 应用的完整启动日志
2. 龙虾 Docker 容器的日志 (`docker logs <container_id>`)
3. 浏览器 Console 的错误信息
4. `openclaw.json` 的内容
