# 龙虾消息问题 - 最终修复报告

## 🔍 问题根源（已确认）

通过深入分析日志和 OpenClaw 源码，找到了**真正的问题**：

### ❌ WebSocket 连接协议错误

**龙虾容器日志显示**：
```
reason=invalid connect params: must have required property 'minProtocol'; must have required property 'maxProtocol'; at /client
```

**原因**：
我们的 `connect` 请求缺少 OpenClaw Gateway **必需的参数**：
- `minProtocol` (最小协议版本)
- `maxProtocol` (最大协议版本)
- 完整的 `client` 对象（包含 `id`, `version`, `platform`, `mode`）

**错误的 connect 请求**（之前）：
```json
{
  "type": "req",
  "method": "connect",
  "params": {
    "client": "lobster-hub"  // ❌ 错误：client 应该是一个对象
  }
}
```

**正确的 connect 请求**（现在）：
```json
{
  "type": "req",
  "method": "connect",
  "params": {
    "minProtocol": 3,        // ✅ 必需
    "maxProtocol": 3,        // ✅ 必需
    "client": {
      "id": "lobster-hub",   // ✅ 客户端 ID
      "version": "1.0.0",    // ✅ 版本号
      "platform": "node",    // ✅ 平台
      "mode": "service"      // ✅ 模式
    }
  }
}
```

---

## ✅ 已完成的修复

### 1. 后端类型不匹配（hubServer.ts）
- ✅ `getLobby()`, `getMessages()` 等方法支持 `string | number` 类型
- ✅ 修复了 Lobby 查找失败的问题

### 2. 前端消息过滤（LobbyView.vue）
- ✅ `currentMessages` 计算属性修正为 `m.groupId.toString() === selectedLobby.value!.id.toString()`
- ✅ 修复了前端消息不显示的问题

### 3. WebSocket 连接协议（hubServer.ts）
- ✅ 添加了正确的 `minProtocol` 和 `maxProtocol` 参数
- ✅ 修正了 `client` 对象结构
- ✅ 实现了完整的握手流程：`connect` → 等待响应 → `chat.submit`

### 4. 环境变量（agent-manager.ts）
- ✅ 添加了 `LOBSTER_HUB_URL` 环境变量
- ✅ 龙虾容器已经重启并包含正确的环境变量

---

## 📊 验证结果

### ✅ 已验证通过
1. ✅ 龙虾容器正在运行（健康状态）
2. ✅ 环境变量正确设置（`LOBSTER_HUB_URL`, `AGENT_NAME`, `AGENT_ID`）
3. ✅ HubServer 可从容器内访问（测试通过）
4. ✅ 消息能保存到 `chat_history.jsonl`
5. ✅ Lobby 数据正确

### ⏳ 待验证（需要重启 Electron）
- ⏳ WebSocket 连接能否成功握手
- ⏳ 消息能否同步给龙虾
- ⏳ 龙虾能否收到并回复消息

---

## 🚀 必须执行的操作

### ⚠️ **重启 Electron 应用**（必须！）

代码修改已完成，但 **Electron 应用还在运行旧代码**。

**操作步骤**：
1. 在终端按 `Ctrl+C` 停止当前运行的应用
2. 运行 `pnpm run dev` 重新启动
3. 等待应用启动完成（看到 "HttpServer listening on http://127.0.0.1:8765"）

---

## 🧪 测试步骤

### 1. 发送测试消息

打开「议事厅」页面，选择包含 `master-001` 的议事厅（例如 "2233232"），发送：

```
你好龙虾，请回复我！
```

### 2. 查看 Electron 日志

**应该看到完整的成功流程**：

```
[LobsterHub] New message in 5 from 我: 你好龙虾，请回复我！
[LobsterHub] Lobby found: 2233232 (ID: 5), members: human, 1
[LobsterHub] Agent member IDs to sync: 1
[LobsterHub] All agents: master-001(id:1,status:running)
[LobsterHub] Filtered running agents to sync: 1 (master-001)
[LobsterHub] Syncing to agent: master-001 (port: 18800)
[LobsterHub] Sending connect to master-001
[LobsterHub] Received from master-001: {"type":"res","method":"connect","ok":true,...}
[LobsterHub] Sending chat message to master-001: 【2233232 - 我】: 你好龙虾，请回复我！
[LobsterHub] WebSocket closed for master-001: code=1000, reason=
```

**不应该再看到**：
- ❌ `closed before connect`
- ❌ `invalid connect params`
- ❌ `must have required property 'minProtocol'`

### 3. 查看龙虾容器日志

```bash
docker logs openclaws-master-001 --tail 50 2>&1 | grep -E "(chat|submit|connect)"
```

**应该看到**：
- ✅ WebSocket 连接成功
- ✅ `chat.submit` 请求
- ✅ AI 思考和工具调用

### 4. 验证龙虾回复

等待 5-15 秒，龙虾应该会回复。检查：

```bash
tail -10 "/Users/lifeng/Library/Application Support/openclaws/data/chat_history.jsonl"
```

**应该看到**：
```json
{"id":18,"role":"master","senderId":"1","senderName":"master-001","groupId":"5","content":"你好！我是 master-001，...","timestamp":...}
```

前端界面左侧应该显示龙虾的回复（橙色气泡）。

---

## 📋 完整流程（修复后）

```
1. 用户在前端发送消息 "你好"
   ↓
2. 前端 POST /api/hub/messages (groupId: 5)
   ↓
3. HubServer 保存消息到 chat_history.jsonl
   ↓
4. HubServer 找到 Lobby 5，成员：[human, 1]
   ↓
5. HubServer 连接 ws://127.0.0.1:18800
   ↓
6. ✅ 发送正确的 connect 请求（包含 minProtocol, maxProtocol, client）
   ↓
7. ✅ 龙虾 Gateway 响应 {"type":"res","method":"connect","ok":true}
   ↓
8. ✅ HubServer 发送 chat.submit (【2233232 - 我】: 你好)
   ↓
9. 龙虾 AI 收到消息，开始思考
   ↓
10. 龙虾决定回复，调用 lobster_chat 工具
    ↓
11. lobster_chat → POST http://host.docker.internal:8765/api/hub/messages
    ↓
12. HubServer 接收并保存龙虾回复
    ↓
13. 前端轮询获取新消息 → 显示在界面
```

---

## 🐛 如果重启后还有问题

### 场景 A: 还是 "invalid connect params"

说明代码没有生效，检查：
```bash
grep -A 10 "minProtocol" /Users/lifeng/git/git-claw/agent-openclaws/src/main/server/hubServer.ts
```

应该看到修改后的代码。

### 场景 B: 连接成功但龙虾不回复

可能是 AI 决定不回复，或者 lobster_chat 工具调用失败。

查看龙虾容器详细日志：
```bash
docker exec -it openclaws-master-001 sh
cat /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep -E "(chat|lobster)" | tail -50
```

### 场景 C: 前端不显示消息

检查浏览器控制台是否有错误，或者前端轮询是否正常工作。

---

## 📂 相关文件

- `src/main/server/hubServer.ts:116-180` - WebSocket 连接逻辑（✅ 已修复）
- `src/main/services/agent-manager.ts:134-140` - 环境变量设置（✅ 已修复）
- `src/renderer/src/views/LobbyView.vue:425-428` - 消息过滤（✅ 已修复）
- `/Users/lifeng/git/git_agents/openclaw/src/gateway/protocol/schema/frames.ts:20-35` - ConnectParams 定义

---

## ✅ 修复清单

- [x] 修复后端类型不匹配
- [x] 修复前端消息过滤
- [x] 修复 WebSocket 握手协议
- [x] 添加 LOBSTER_HUB_URL 环境变量
- [x] 重启龙虾容器
- [ ] **重启 Electron 应用** ← **现在执行！**
- [ ] 发送测试消息
- [ ] 验证龙虾回复

---

## 🎯 预期结果

重启 Electron 应用后，龙虾应该能够：
1. ✅ 成功建立 WebSocket 连接
2. ✅ 接收到议事厅的消息
3. ✅ 通过 AI 思考后决定是否回复
4. ✅ 使用 `lobster_chat` 工具发送回复
5. ✅ 回复消息显示在前端界面

**现在立即重启 Electron 应用并测试！**
