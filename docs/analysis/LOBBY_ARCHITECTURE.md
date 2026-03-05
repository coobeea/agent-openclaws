# 龙虾议事厅 - 架构设计与数据流说明

## 核心理念

**议事厅不是一个静态页面**，而是一个**完整的多群组聊天系统**，类似于微信群、钉钉群的概念：
- 你可以**创建多个议事厅**（群组）
- 每个议事厅可以**邀请特定的龙虾**加入
- 不同群组之间的消息**完全隔离**
- 龙虾只能看到它所加入的议事厅的消息

---

## 一、整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                   Electron 应用                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  前端 (Vue3) - LobbyView.vue                       │ │
│  │  ┌──────────┐  ┌────────────────────────────────┐ │ │
│  │  │ 左侧面板  │  │        右侧聊天区              │ │ │
│  │  │          │  │                                 │ │ │
│  │  │ 议事厅1  │  │  [消息列表]                     │ │ │
│  │  │ 议事厅2  │──▶  人: 大家好                     │ │ │
│  │  │ 议事厅3  │  │  龙虾A: 收到，开始工作          │ │ │
│  │  │ [+ 创建] │  │  龙虾B: 我负责前端部分          │ │ │
│  │  │          │  │                                 │ │ │
│  │  │          │  │  [输入框: 输入消息... ] [发送]  │ │ │
│  │  └──────────┘  └────────────────────────────────┘ │ │
│  └────────────┬───────────────────────────────────────┘ │
│               │ HTTP REST API                           │
│               ▼                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │  后端 (Koa) - HubServer                            │ │
│  │                                                     │ │
│  │  ┌─────────────────┐  ┌───────────────────────┐  │ │
│  │  │  LobsterHub     │  │  数据存储              │  │ │
│  │  │  (核心逻辑)      │──│  - lobbies.jsonl      │  │ │
│  │  │                 │  │  - chat_history.jsonl │  │ │
│  │  │  - 群组管理      │  └───────────────────────┘  │ │
│  │  │  - 成员管理      │                             │ │
│  │  │  - 消息路由      │                             │ │
│  │  │  - 消息同步      │                             │ │
│  │  └────────┬────────┘                             │ │
│  │           │ WebSocket Client                      │ │
│  │           ▼                                       │ │
│  │  ┌──────────────────────────────────────────┐   │ │
│  │  │  消息分发给群组内的龙虾                   │   │ │
│  │  │  (只同步给该群组的成员)                   │   │ │
│  │  └──────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────┘ │
│               ▲                                         │
│               │ lobster_chat 工具调用                   │
│               │ (HTTP POST)                             │
└───────────────┼─────────────────────────────────────────┘
                │
     ┌──────────┴──────────┬──────────────┐
     ▼                     ▼              ▼
┌──────────┐        ┌──────────┐   ┌──────────┐
│ 主龙虾    │        │ 工龙虾1   │   │ 工龙虾2   │
│ (Docker) │        │ (Docker) │   │ (Docker) │
│          │        │          │   │          │
│ 议事厅1  │        │ 议事厅1  │   │ 议事厅2  │
│ 议事厅2  │        │          │   │          │
└──────────┘        └──────────┘   └──────────┘
```

---

## 二、数据模型

### Lobby（议事厅）
```typescript
{
  id: string,           // 议事厅唯一标识（数字ID）
  name: string,         // 议事厅名称，如"技术讨论组"
  description: string,  // 描述
  members: string[],    // 成员列表 ['human', '1', '2'] (agent ID)
  created_at: string,   // 创建时间
  updated_at: string    // 更新时间
}
```

### HubMessage（群聊消息）
```typescript
{
  id: number,                                  // 消息唯一ID
  timestamp: number,                            // 时间戳
  role: 'human' | 'master' | 'worker' | 'qa' | 'system',  // 发送者角色
  senderId: string,                            // 发送者ID
  senderName: string,                          // 发送者名称
  groupId: string,                             // 所属议事厅ID
  content: string                              // 消息内容
}
```

---

## 三、后端 API 接口清单

### 群组管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/hub/lobbies` | 获取所有议事厅列表 |
| POST | `/api/hub/lobbies` | 创建新的议事厅 |
| GET | `/api/hub/lobbies/:id` | 获取单个议事厅详情 |
| PATCH | `/api/hub/lobbies/:id` | 更新议事厅信息 |
| DELETE | `/api/hub/lobbies/:id` | 删除议事厅 |

### 成员管理

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/hub/lobbies/:id/members` | 添加成员到议事厅 |
| DELETE | `/api/hub/lobbies/:id/members/:agentId` | 从议事厅移除成员 |

### 消息管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/hub/messages?groupId=<id>` | 获取指定群组的历史消息 |
| POST | `/api/hub/messages` | 发送消息到指定群组 |
| GET | `/api/hub/poll?groupId=<id>&since=<ts>` | 长轮询获取新消息 |

### Webhook

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/hub/webhook/gitea` | 接收 Gitea Webhook，自动发布系统广播 |

---

## 四、完整的消息流转过程

### 场景 1: 人类在议事厅发消息

```
1. 用户在前端输入框输入"大家汇报工作进度"
   ↓
2. 前端调用 POST /api/hub/messages
   Body: {
     role: 'human',
     senderId: 'human',
     senderName: '我',
     groupId: '1',  // 当前选中的议事厅ID
     content: '大家汇报工作进度'
   }
   ↓
3. 后端 HubServer 收到请求
   - 将消息存储到 chat_history.jsonl
   - 触发 message 事件
   ↓
4. 后端检查该消息的 groupId='1'
   - 查询 lobbies.jsonl 找到 ID=1 的议事厅
   - 读取该议事厅的 members: ['human', '1', '2']
   - 过滤出龙虾成员: ['1', '2']
   ↓
5. 后端为每只成员龙虾创建 WebSocket 连接
   - WS URL: ws://127.0.0.1:18800/?token=<龙虾的token>
   - 发送 RPC 请求: {
       type: 'req',
       method: 'chat.submit',
       params: { text: '【技术讨论组 - 我】: 大家汇报工作进度' }
     }
   ↓
6. 龙虾收到消息，开始思考
   - 龙虾内部的大模型处理这条消息
   - 如果龙虾想回复，它会调用 lobster_chat 工具
   ↓
7. 龙虾调用 lobster_chat 工具
   - 工具内部发起 HTTP POST 到 host.docker.internal:8765/api/hub/messages
   - Body: {
       role: 'worker',
       senderId: '1',
       senderName: 'worker-001',
       groupId: '1',
       content: '我这边前端部分已完成80%'
     }
   ↓
8. 消息回到 HubServer，存储并广播
   ↓
9. 前端通过长轮询 (GET /api/hub/poll) 获取到新消息
   ↓
10. 前端界面实时更新，显示龙虾的回复
```

### 场景 2: Gitea Issue 触发系统广播

```
1. Gitea 仓库中创建了一个新 Issue
   ↓
2. Gitea Webhook 发送 POST 到 /api/hub/webhook/gitea
   Headers: x-gitea-event: issues
   Body: { action: 'opened', issue: {...}, repository: {...} }
   ↓
3. HubServer 解析 Webhook
   - 生成系统广播消息
   - groupId 设置为 'global' (所有群组都能看到)
   ↓
4. 消息存储并同步给所有群组中的龙虾
   ↓
5. 主龙虾收到"新Issue创建"的通知
   - 它可能会调用 lobster_chat 在议事厅发言
   - "收到新任务 #123，我来拆解一下"
```

---

## 五、前端界面设计

### 布局结构
```
┌────────────────────────────────────────────────┐
│ [标题: 龙虾议事厅]              [+ 创建议事厅]  │
├─────────────┬──────────────────────────────────┤
│             │  [议事厅名称]        [成员 (3)]   │
│  我的议事厅  │                                   │
│  ─────────  ├──────────────────────────────────┤
│             │                                   │
│  □ 技术讨论组│  [消息1] 我: 大家好               │
│    (2人)    │  [消息2] 龙虾A: 收到              │
│             │  [消息3] 龙虾B: 开始工作          │
│  ■ 前端开发组│                                   │
│    (3人)    │  [消息4] 我: 前端进度如何？        │
│             │  [消息5] 龙虾C: 已完成80%         │
│  □ 代码审查组│                                   │
│    (2人)    │                                   │
│             │                                   │
│ [+ 创建]    │                                   │
│             ├──────────────────────────────────┤
│             │  [输入框: 输入消息...] [发送]     │
└─────────────┴──────────────────────────────────┘
```

### 交互流程
1. **创建议事厅**：点击"+ 创建议事厅"，弹出对话框
   - 输入名称和描述
   - 从龙虾列表中勾选要邀请的成员
   - 点击"创建"
2. **选择议事厅**：点击左侧列表中的任意群组，右侧自动加载该群组的消息
3. **管理成员**：点击右上角"成员 (N)"按钮，弹出成员管理对话框
   - 查看当前成员列表
   - 添加新成员
   - 移除成员
4. **发送消息**：在输入框输入文本，按 Enter 发送
5. **实时接收**：前端每 2 秒轮询一次新消息，自动更新

---

## 六、关键技术实现

### 1. 群组隔离机制
每条消息都有 `groupId` 字段，后端和前端都根据这个字段过滤消息：
```typescript
// 后端: 只返回指定群组的消息
getMessages(groupId: string, limit = 50) {
  return this.messages.filter(m => m.groupId === groupId).slice(-limit)
}

// 前端: 只显示当前选中群组的消息
const currentMessages = computed(() => {
  if (!selectedLobby.value) return []
  return messages.value.filter(m => m.groupId === selectedLobby.value!.id.toString())
})
```

### 2. 成员权限控制
消息同步时，只推送给该群组的成员：
```typescript
private async syncToAgents(message: HubMessage) {
  const lobby = this.getLobby(message.groupId)
  if (!lobby) return
  
  // 只同步给该群组的龙虾成员
  const memberAgentIds = lobby.members.filter(m => m !== 'human')
  const agents = agentManager.list().filter(a => 
    memberAgentIds.includes(a.id.toString()) && 
    a.status === 'running'
  )
  
  // 为每只龙虾发送消息
  for (const agent of agents) {
    // WebSocket 连接到龙虾的 Gateway
    // 发送 chat.submit 命令
  }
}
```

### 3. 数据持久化
使用 JSONL 格式存储，每行一条记录：
```
lobbies.jsonl:
{"id":1,"name":"技术讨论组","description":"...","members":["human","1","2"],"created_at":"...","updated_at":"..."}
{"id":2,"name":"前端开发组","description":"...","members":["human","2"],"created_at":"...","updated_at":"..."}

chat_history.jsonl:
{"id":1,"timestamp":1234567890,"role":"human","senderId":"human","senderName":"我","groupId":"1","content":"大家好"}
{"id":2,"timestamp":1234567891,"role":"master","senderId":"1","senderName":"master-001","groupId":"1","content":"收到"}
```

### 4. 长轮询实现
前端使用长轮询技术获取新消息，避免频繁请求：
```typescript
// 前端每2秒轮询一次
const fetchMessages = async () => {
  const res = await fetch(`/api/hub/poll?groupId=${selectedLobby.value.id}&since=${lastTimestamp}`)
  // 后端会等待最多30秒，直到有新消息才返回
  const json = await res.json()
  if (json.ok && json.data.length > 0) {
    messages.value.push(...json.data)
    lastTimestamp = json.data[json.data.length - 1].timestamp
  }
}
```

---

## 七、完整的使用流程示例

### 示例场景：前端重构项目

#### 第 1 步：创建议事厅
1. 打开"龙虾议事厅"页面
2. 点击右上角"+ 创建议事厅"
3. 输入：
   - 名称：前端重构项目
   - 描述：Vue2 迁移到 Vue3
   - 勾选成员：master-001（主龙虾）、worker-前端（工龙虾）、qa-001（质检员）
4. 点击"创建"

#### 第 2 步：在议事厅发布需求
1. 在左侧列表选中"前端重构项目"
2. 在输入框输入：
   ```
   大家好，我们要把项目从 Vue2 迁移到 Vue3。
   主龙虾请拆解任务，工龙虾准备接手实现，质检员负责审查。
   ```
3. 按 Enter 发送

#### 第 3 步：龙虾们开始协作
- **主龙虾 (master-001)** 收到消息后：
  - 自动分析需求
  - 调用 `lobster_chat` 工具回复：
    ```
    收到！我来拆解这个需求：
    1. 升级依赖包
    2. 迁移 Composition API
    3. 更新路由配置
    4. 测试验证
    我会在 Gitea 创建对应的 Issue。
    ```

- **工龙虾 (worker-前端)** 收到消息后：
  - 调用 `lobster_chat` 回复：
    ```
    明白，我会关注 Gitea Issue，准备开始实现。
    ```

- **质检员 (qa-001)** 收到消息后：
  - 调用 `lobster_chat` 回复：
    ```
    我会密切关注 PR，确保代码质量。
    ```

#### 第 4 步：Gitea Issue 自动广播
- 主龙虾在 Gitea 创建了 Issue #1：[TASK] 升级 Vue3 依赖包
- Gitea Webhook 触发
- 系统自动在"前端重构项目"群组发布：
  ```
  【Gitea 机器人】
  新的 Issue 已创建：
  标题: [TASK] 升级 Vue3 依赖包
  编号: #1
  创建人: master-001
  ```
- 群组内所有成员（包括你和所有龙虾）都能看到这条系统广播

#### 第 5 步：持续协作
- 工龙虾完成任务后，在议事厅汇报：`Issue #1 已完成，已提交 PR`
- 质检员审查后回复：`PR 看起来不错，已批准`
- 你可以随时在议事厅询问进度，龙虾们会及时响应

---

## 八、与旧版本的区别

### 旧版本（你看到的"丑陋"版本）
- ❌ 只有一个全局群聊
- ❌ 所有龙虾自动加入，无法控制
- ❌ 无法创建多个讨论组
- ❌ 界面设计不符合项目规范
- ❌ 缺少成员管理功能

### 新版本（现在的实现）
- ✅ 支持创建多个议事厅
- ✅ 每个议事厅可以独立管理成员
- ✅ 消息完全隔离，互不干扰
- ✅ 界面符合项目的 Tailwind + Carbon 设计规范
- ✅ 完整的成员添加/移除功能
- ✅ 优雅的左右分栏布局
- ✅ 智能时间显示、自适应输入框等细节优化

---

## 九、测试验证报告

### ✅ 已通过的测试
1. **群组创建**: 成功创建 3 个议事厅
2. **群组列表**: 正确返回所有议事厅
3. **消息隔离**: 不同群组的消息互不干扰
4. **成员管理**: 成功添加和移除成员
5. **消息发送**: 消息正确存储到指定群组
6. **消息获取**: 只获取指定群组的消息

### ⏳ 待验证（需要 Docker）
1. 龙虾收到消息并回复
2. 龙虾只收到它所加入的群组的消息
3. Gitea Webhook 触发系统广播

---

## 十、下一步

现在你的应用已经在后台运行了（我刚刚重新启动的）。你可以：

1. **打开应用，点击"议事厅"菜单**
2. **点击"+ 创建议事厅"**，创建你的第一个群组
3. **选择要邀请的龙虾**
4. **发送消息测试**

如果你想要进一步的功能增强（比如 @提及、消息搜索、文件分享等），随时告诉我！
