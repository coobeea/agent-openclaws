# OpenClaws - 龙虾军团管理系统

基于 OpenClaw 的多智能体协作管理平台。Electron 单端口客户端，内嵌 Koa HTTP 服务 + WebSocket Gateway，前端 Vue3 渲染。

## 架构

```
┌─────────────────────────────────────────────┐
│                Electron App                  │
│  ┌─────────────────────────────────────────┐ │
│  │  Main Process                           │ │
│  │  ┌──────────┐  ┌──────────────────────┐ │ │
│  │  │ Koa HTTP │──│ Gateway (WS + REST)  │ │ │
│  │  │ :8765    │  │  system / agents /   │ │ │
│  │  └──────────┘  │  tasks / gitea       │ │ │
│  │                └──────────┬───────────┘ │ │
│  │  ┌──────────┐  ┌─────────┴──────────┐  │ │
│  │  │ SQLite   │  │ Services           │  │ │
│  │  │ Database │  │ agent-manager      │  │ │
│  │  └──────────┘  │ task-dispatcher    │  │ │
│  │                │ docker-manager     │  │ │
│  │                │ gitea-client       │  │ │
│  │                └────────────────────┘  │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │  Renderer Process (Vue3)                │ │
│  │  Dashboard │ Agents │ Tasks │ Gitea     │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Gitea    │ │ Worker   │ │ Worker   │
    │ :13000   │ │ (Docker) │ │ (Docker) │
    └──────────┘ └──────────┘ └──────────┘
```

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Electron + electron-vite |
| 前端 | Vue 3 + Vue Router + Pinia + Tailwind CSS 4 + Carbon Icons |
| 后端 | Koa (嵌入主进程) + WebSocket Gateway |
| 数据库 | SQLite (better-sqlite3) |
| 容器 | Dockerode |
| 代码管理 | Gitea REST API v1 |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 构建
npm run build

# 预览构建产物
npm run start
```

## 功能模块

- **仪表盘** — 系统运行总览、Gateway 连接状态
- **智能体管理** — 创建/启动/停止 Worker，编辑工作区文件（SOUL.md 等）
- **任务中心** — 提交需求、自动拆解、Gitea Issue 同步、状态追踪
- **Gitea 集成** — 查看仓库/Issue/PR，合并 PR
- **设置** — Gitea、Docker、OpenClaw 配置

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCLAWS_GITEA_URL` | Gitea 服务地址 | `http://localhost:13000` |
| `OPENCLAWS_GITEA_TOKEN` | Gitea API Token | (空) |
