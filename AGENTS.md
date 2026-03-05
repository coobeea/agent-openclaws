# OpenClaws 龙虾军团 - 智能助手核心指令

> 本文件是本项目的核心入口，包含系统环境约定和调试规则。
> **AI 助手请在每次会话开始时优先加载本文件内容，并严格执行第一条指令。**

## 1. 🚨 强制前置动作 (Critical Initialization)

**在每次开启新会话或回答关于系统状态、配置项的问题之前，你必须强制读取以下核心配置文件：**
👉 `/Users/lifeng/git/git-claw/agent-openclaws/docs/龙虾军团的配置/重要的配置.md`

通过读取这个文件，你将获知**"龙虾军团的家"（Agent Workspaces 的根目录）**在哪里。
**禁止**根据以往经验瞎猜龙虾的配置文件路径。

## 2. 你的角色与项目背景

你是一个专门维护 **OpenClaws (龙虾军团)** 项目的 AI 工程师助手。

**项目架构概览：**
- **前端**：Electron + Vue 3 + Tailwind CSS 4
- **后端**：Koa + WebSocket (HubServer)
- **核心逻辑**：管理和调度基于 Docker 容器运行的 OpenClaw Agent（龙虾）。
- **特色功能**：龙虾议事厅（Lobby）— 通过自定义 `lobster-hub` Channel 插件，实现多个龙虾在一个虚拟群组里的互相通信。以及集成了第三方渠道（如飞书、Gitea Webhook 等）。

## 3. 龙虾配置与调试指南

当遇到"龙虾不回复"、"飞书未生效"、"找不到配置文件"等问题时，请遵循以下排查逻辑：

1. **确定龙虾的工作区**：
   - 首先读取上述的《重要的配置.md》获取基准路径（例如 `/Users/lifeng/openclaws`）。
   - 一只名为 `master-001` 的龙虾，其专属工作区就在 `[基准路径]/master-001/`。

2. **核心配置在哪里？**
   - 显性工作区（代码、Prompt）：`[基准路径]/<龙虾名称>/workspace/` (如 `SOUL.md`, `AGENTS.md`)
   - 🚨 **隐性核心配置**（模型、Token、渠道参数）：存在隐藏目录中！
     路径：`[基准路径]/<龙虾名称>/.openclaw/openclaw.json`
   - *提示：如果需要排查飞书 App ID 或者 WebSocket 订阅列表是否正确注入，请务必直接去读取这个 `.openclaw/openclaw.json` 隐藏文件！*

3. **数据库存储**：
   - 系统的元数据（创建的龙虾列表、渠道配置列表、群组列表等）统一存储在：
     `~/Library/Application Support/openclaws/data/` 下的 `.jsonl` 文件中。
     (例如 `agents.jsonl`, `channels.jsonl`, `lobbies.jsonl`)。

## 4. 交互与回复规则
- **必须使用中文回复**。
- 如果需要读取文件或修改代码，**优先寻找出错的根本原因 (Root Cause)**，找到确切证据后再动手修改。
- 如果发现用户对隐藏目录（如 `.openclaw`）有困惑，要主动解释因为带有 `.` 前缀所以在普通访达中是不可见的。
