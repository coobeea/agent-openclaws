# 龙虾消息调试指南

## 问题：龙虾不回复消息

用户反馈：消息能发送，但龙虾不回复。

---

## 🔍 已发现的问题

### ❌ **问题 1: 缺少 LOBSTER_HUB_URL 环境变量**

**检查方法**：
```bash
docker exec openclaws-master-001 env | grep LOBSTER_HUB_URL
```

**当前状态**：❌ 未设置

**修复**：已在 `agent-manager.ts:140` 添加：
```typescript
LOBSTER_HUB_URL: 'http://host.docker.internal:8765/api/hub/messages'
```

⚠️ **需要重启龙虾容器才能生效！**

---

## 🚀 立即修复步骤

### 1️⃣ 重启 Electron 应用

```bash
# Ctrl+C 停止当前应用
pnpm run dev
```

### 2️⃣ 重启龙虾容器

**方式 A: 在前端界面操作**
1. 打开「龙虾」页面
2. 找到 `master-001`
3. 点击「重启」按钮

**方式 B: 命令行操作**
```bash
docker restart openclaws-master-001
```

### 3️⃣ 验证环境变量已设置

```bash
docker exec openclaws-master-001 env | grep -E "(AGENT|LOBSTER|HUB)"
```

**预期输出**：
```
AGENT_NAME=master-001
AGENT_ID=1
LOBSTER_HUB_URL=http://host.docker.internal:8765/api/hub/messages
```

---

## 🧪 测试龙虾回复

### 1. 发送测试消息

1. 打开「议事厅」页面
2. 选择包含 `master-001` 的议事厅
3. 发送："你好，请回复我"

### 2. 查看 Electron 日志

应该看到完整流程：
```
[LobsterHub] New message in 5 from 我: 你好，请回复我
[LobsterHub] Lobby found: 2233232 (ID: 5), members: human, 1
[LobsterHub] Syncing to agent: master-001 (port: 18800)
[LobsterHub] Sending connect to master-001
[LobsterHub] Received from master-001: {"type":"res","method":"connect",...}
[LobsterHub] Sending chat message to master-001: 【2233232 - 我】: 你好，请回复我
```

### 3. 查看龙虾容器日志

```bash
docker logs openclaws-master-001 --tail 50 2>&1 | grep -E "(chat|submit|lobster)"
```

**应该看到**：
- `chat.submit` 请求
- AI 思考过程
- `lobster_chat` 工具调用（如果龙虾决定回复）

### 4. 检查龙虾回复消息

```bash
tail -5 "/Users/lifeng/Library/Application Support/openclaws/data/chat_history.jsonl"
```

**如果龙虾回复了，应该看到**：
```json
{"id":13,"role":"master","senderId":"1","senderName":"master-001","groupId":"5","content":"你好！...","timestamp":...}
```

---

## 🐛 常见问题排查

### 问题 A: 龙虾收到消息但不回复

**可能原因**：
1. AI 模型决定不回复（认为不需要回复）
2. `lobster_chat` 工具调用失败
3. HubServer 不可达

**检查方法**：
```bash
# 进入容器查看详细日志
docker exec -it openclaws-master-001 sh
cat /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | tail -100

# 或者直接查看 gateway 日志
docker logs openclaws-master-001 --tail 200 2>&1
```

**查找关键词**：
- `lobster_chat` - 工具是否被调用
- `error` - 是否有错误
- `ECONNREFUSED` - HubServer 连接失败

### 问题 B: WebSocket 握手失败

**症状**：日志显示 `closed before connect` 或 `invalid handshake`

**检查**：
```bash
docker logs openclaws-master-001 --tail 50 2>&1 | grep -E "(closed|handshake)"
```

**原因**：`syncToAgents` 代码未正确实现 OpenClaw Gateway 的连接协议

**已修复**：最新代码已实现正确的握手流程（先 connect，后 chat.submit）

### 问题 C: HubServer 不可达

**测试连通性**（从容器内）：
```bash
docker exec openclaws-master-001 curl -s http://host.docker.internal:8765/api/hub/lobbies
```

**预期**：返回议事厅列表 JSON

**如果失败**：
- 检查 Electron 应用是否在运行
- 检查 HubServer 是否监听在 8765 端口
- 检查 Docker 网络配置

---

## 📊 完整调试命令集

```bash
# 1. 检查容器状态
docker ps | grep openclaws

# 2. 检查环境变量
docker exec openclaws-master-001 env | grep -E "(AGENT|LOBSTER|HUB)"

# 3. 检查 openclaw.json
docker exec openclaws-master-001 cat /home/node/.openclaw/openclaw.json | grep -A 5 "plugins"

# 4. 查看实时日志
docker logs openclaws-master-001 --tail 100 -f

# 5. 测试 HubServer 连通性
docker exec openclaws-master-001 curl -s http://host.docker.internal:8765/api/hub/lobbies

# 6. 查看消息历史
tail -10 "/Users/lifeng/Library/Application Support/openclaws/data/chat_history.jsonl"

# 7. 进入容器交互式调试
docker exec -it openclaws-master-001 sh
```

---

## 🎯 预期的完整流程

### 1. 用户发送消息
```
前端 → POST /api/hub/messages (groupId: 5, content: "你好")
```

### 2. HubServer 处理
```
保存消息 → 找到 Lobby 5 → 过滤成员 [1] → 连接 ws://127.0.0.1:18800
```

### 3. WebSocket 握手
```
HubServer → connect 请求
龙虾 Gateway → connect 响应 (OK)
HubServer → chat.submit 请求 (【2233232 - 我】: 你好)
```

### 4. 龙虾处理
```
AI 收到消息 → 思考 → 决定回复
AI → 调用 lobster_chat 工具 (content: "你好！我是 master-001")
lobster_chat → POST http://host.docker.internal:8765/api/hub/messages
```

### 5. HubServer 接收龙虾回复
```
接收 POST 请求 → 保存消息 (role: master, senderId: 1)
```

### 6. 前端显示
```
轮询 /api/hub/poll?groupId=5&since=... → 获取新消息 → 显示在左侧
```

---

## ✅ 修复清单

- [x] 修复后端类型不匹配（hubServer.ts）
- [x] 修复前端消息过滤（LobbyView.vue）
- [x] 修复 WebSocket 握手协议（hubServer.ts syncToAgents）
- [ ] **添加 LOBSTER_HUB_URL 环境变量（agent-manager.ts）** ← **已修复，需要重启**
- [ ] 重启 Electron 应用
- [ ] 重启龙虾容器
- [ ] 验证环境变量
- [ ] 测试消息发送和回复

---

## 📞 需要进一步帮助？

如果按照以上步骤操作后龙虾仍然不回复，请提供：

1. **Electron 日志**（完整的 syncToAgents 流程）
2. **龙虾容器日志**（`docker logs openclaws-master-001 --tail 200`）
3. **chat_history.jsonl 最后 10 行**
4. **环境变量验证结果**（`docker exec ... env | grep LOBSTER`）

我会根据这些信息进一步排查！
