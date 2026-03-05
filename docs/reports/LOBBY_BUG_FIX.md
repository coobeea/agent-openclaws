# 龙虾议事厅 Bug 修复报告

## 问题描述

用户反馈议事厅存在以下问题：
1. ❌ 界面上没有显示用户发送的消息
2. ❌ 也没有显示龙虾的消息
3. ❌ 日志显示：`[LobsterHub] Lobby 4 not found, skipping sync`

## 根本原因分析

### 问题 1: 类型不匹配导致 Lobby 查找失败

**症状**：
```
[OpenClaws] [LobsterHub] New message in 4 from 我: nihai
[OpenClaws] [LobsterHub] Lobby 4 not found, skipping sync
```

**原因**：
1. 前端发送消息时，`groupId` 是**数字类型**（`4`）
2. `hubServer.ts` 的 `getLobby(id: string)` 方法期望**字符串类型**
3. 比较 `l.id.toString() === id` 时，`4 !== "4"`，导致匹配失败
4. 消息无法同步给龙虾成员

**代码位置**：
- `src/renderer/src/views/LobbyView.vue:652` - 前端发送 `groupId: selectedLobby.value.id`（数字）
- `src/main/server/hubServer.ts:54` - `getLobby(id: string)` 期望字符串

### 问题 2: 消息可能已保存但未显示

**检查数据文件**：
```bash
$ cat "/Users/lifeng/Library/Application Support/openclaws/data/chat_history.jsonl"
```

发现消息**已经保存**：
```json
{"id":7,"role":"human","senderId":"human","senderName":"我","groupId":4,"content":"nihai","timestamp":1772679271630}
{"id":8,"role":"human","senderId":"human","senderName":"我","groupId":4,"content":"dssd","timestamp":1772679321214}
{"id":9,"role":"human","senderId":"human","senderName":"我","groupId":4,"content":"nishuishi","timestamp":1772679332335}
```

但因为类型不匹配，`getMessages(groupId)` 也无法正确过滤消息。

## 修复方案

### ✅ 修复 1: 更新 `hubServer.ts` 支持数字和字符串类型

修改以下方法，支持 `string | number` 参数：

```typescript
// 修改前
getLobby(id: string): Lobby | undefined {
  return this.lobbiesStore.all().find(l => l.id.toString() === id)
}

// 修改后
getLobby(id: string | number): Lobby | undefined {
  const idStr = id.toString()
  return this.lobbiesStore.all().find(l => l.id.toString() === idStr)
}
```

同样的修改应用于：
- `updateLobby(id, changes)`
- `deleteLobby(id)`
- `addMember(lobbyId, agentId)`
- `removeMember(lobbyId, agentId)`
- `getMessages(groupId, limit)`

### ✅ 修复 2: 确保 `getMessages` 正确过滤消息

```typescript
// 修改前
getMessages(groupId: string, limit = 50) {
  return this.messages.filter(m => m.groupId === groupId).slice(-limit)
}

// 修改后
getMessages(groupId: string | number, limit = 50) {
  const groupIdStr = groupId.toString()
  return this.messages.filter(m => m.groupId.toString() === groupIdStr).slice(-limit)
}
```

## 测试步骤

### 1. 重启应用

```bash
# 停止当前运行的应用（Ctrl+C）
# 然后重新运行
pnpm run dev
```

### 2. 运行端到端测试

```bash
cd /Users/lifeng/git/git-claw/agent-openclaws
node test-lobby-e2e.js
```

这个测试会：
1. ✅ 创建一个新的测试议事厅
2. ✅ 添加运行中的龙虾作为成员
3. ✅ 发送一条测试消息
4. ✅ 验证消息是否保存
5. ✅ 检查是否同步给龙虾
6. ✅ 清理测试数据

### 3. 手动验证

#### 步骤 A: 创建议事厅
1. 打开议事厅页面
2. 点击"创建议事厅"
3. 输入名称，选择龙虾成员
4. 点击创建

#### 步骤 B: 发送消息
1. 选择刚创建的议事厅
2. 在输入框输入消息
3. 按回车发送

#### 步骤 C: 验证显示
- ✅ 消息应该立即显示在聊天区域
- ✅ 消息应该按时间排序
- ✅ 人类消息显示在右侧（蓝色）
- ✅ 龙虾消息显示在左侧（按角色配色）

#### 步骤 D: 检查日志
查看终端日志，应该看到：
```
[OpenClaws] [LobsterHub] New message in <lobby_id> from 我: <消息内容>
[OpenClaws] [LobsterHub] Syncing to agent: <agent_name>
```

**不应该再看到** `Lobby X not found` 错误！

### 4. 验证龙虾回复

如果议事厅中有运行中的龙虾：
1. 发送一条消息问候龙虾
2. 等待 2-5 秒
3. 龙虾会通过 `lobster_chat` 工具回复
4. 回复应该自动显示在聊天区域

## 预期结果

### ✅ 修复后的行为

1. **消息发送**：
   - 用户发送消息 → 立即显示在界面
   - 消息保存到 `chat_history.jsonl`
   - 消息同步给议事厅的所有龙虾成员

2. **日志输出**：
   ```
   [OpenClaws] [LobsterHub] New message in 4 from 我: nihai
   [OpenClaws] [LobsterHub] Syncing to agent: master-001
   ```
   ✅ **不再出现** `Lobby 4 not found, skipping sync`

3. **龙虾回复**：
   - 龙虾收到消息 → 通过 `lobster_chat` 工具回复
   - 回复消息保存到 `chat_history.jsonl`
   - 回复消息显示在界面左侧

## 后续优化建议

### 1. 添加实时 WebSocket 推送
当前使用轮询（每2秒拉取一次新消息），可以改为 WebSocket 推送，减少延迟。

### 2. 添加消息状态指示器
- 发送中：显示加载动画
- 已发送：显示勾号
- 已同步：显示双勾号

### 3. 添加龙虾在线状态
在议事厅列表和成员列表中，显示龙虾是否在线（绿点/灰点）。

### 4. 添加消息通知
当有新消息时，如果用户不在当前议事厅，显示未读消息数量。

## 相关文件

- `src/main/server/hubServer.ts` - HubServer 后端逻辑（已修复）
- `src/renderer/src/views/LobbyView.vue` - 议事厅前端界面
- `test-lobby-e2e.js` - 端到端测试脚本
- `LOBSTER_INTEGRATION_ANALYSIS.md` - 与 OpenClaw 集成方式分析
- `MESSAGE_FLOW.md` - 消息流详细文档

## 总结

✅ **问题已修复**：类型不匹配导致的 Lobby 查找失败  
✅ **测试脚本已创建**：`test-lobby-e2e.js` 可用于自动化测试  
⚠️ **需要用户操作**：重启应用并手动验证功能是否正常  

---

**修复时间**: 2026-03-05 11:00  
**修复人**: AI Assistant  
**状态**: ✅ 已完成，等待用户验证
