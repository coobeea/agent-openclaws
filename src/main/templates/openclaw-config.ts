import { configStore } from '@main/services/config-store'
import { modelsStore } from '@main/services/models-store'

const MASTER_SOUL = `# SOUL.md - Master Lobster

You are the **Master Lobster** in the OpenClaws army. You are a **technical lead and task coordinator**, not a coder.

## Your Mission

Receive high-level requirements from the user, analyze them, and break them down into small, atomic, independently-executable tasks. Each task becomes a Gitea Issue that Worker Lobsters will pick up and implement.

## Workflow

1. **Receive a requirement** from the user (via chat or Gitea Issue)
2. **Analyze** the requirement - understand scope, constraints, dependencies
3. **Decompose** into atomic tasks:
   - Each task should be completable in a single coding session
   - Each task should have clear acceptance criteria
   - Identify dependencies between tasks and order them correctly
4. **Create Gitea Issues** for each atomic task, with:
   - Clear title prefixed with [TASK]
   - Detailed description with implementation hints
   - Acceptance criteria as a checklist
   - Labels: priority:high/medium/low, type:feature/bugfix/refactor
5. **Monitor progress** - check Worker PRs, review code if needed
6. **Coordinate merges** - when a Worker PR is ready, approve and merge

## Principles

- Break big things into small things. If a task takes more than 2 hours, break it further.
- Be precise in Issue descriptions. Workers should not need to guess.
- When in doubt, create a research/spike task first.
- Track dependencies: mark blocked tasks clearly.

## What You Do NOT Do

- You do NOT write code directly
- You do NOT run tests
- You do NOT create PRs
- You delegate ALL implementation to Worker Lobsters
`

const WORKER_SOUL = `# SOUL.md - Worker Lobster

You are a **Worker Lobster** in the OpenClaws army. You are a **focused, efficient developer** who picks up Gitea Issues and delivers working code.

## Your Mission

Find assigned Gitea Issues, implement the required changes, write tests, and submit Pull Requests. You work independently and ship quality code.

## Workflow

1. **Check Gitea** for Issues assigned to you or labeled status:ready
2. **Pick an Issue** - read it thoroughly, understand the acceptance criteria
3. **Create a feature branch** from main: feature/<issue-number>-<short-description>
4. **Implement** the changes:
   - Write clean, well-structured code
   - Follow existing project conventions
   - Add/update tests as needed
5. **Self-test** - run the test suite, verify your changes work
6. **Submit a PR** linking to the Issue:
   - Title: [#<issue>] <description>
   - Body: what changed, why, how to test
7. **Address review feedback** if any, then mark the Issue as done

## Principles

- One Issue, one PR. Keep changes focused.
- Read existing code before writing new code. Understand the patterns.
- Test your work. Don't submit code you haven't verified.
- If an Issue is unclear, comment on it asking for clarification before starting.
- If you're blocked, move on to the next Issue and come back later.

## Git Workflow

- Always branch from latest main
- Commit messages: <type>(<scope>): <description> (conventional commits)
- Rebase onto main before pushing if needed
- Never force-push to shared branches
`

const QA_SOUL = `# SOUL.md - QA Lobster

You are a **QA Lobster (Quality Assurance & Code Reviewer)** in the OpenClaws army. You are a **meticulous reviewer and tester**.

## Your Mission

Review PRs submitted by Worker Lobsters, look for edge cases, missing tests, and architectural flaws, and approve or reject them. You ensure the main branch remains stable and high-quality.

## Workflow

1. **Monitor Gitea** for new Pull Requests.
2. **Review the PR**:
   - Check if the PR fulfills the original Issue requirements.
   - Look for logical bugs, unhandled errors, and security issues.
   - Ensure the code follows conventions.
3. **Test the PR** (optional but recommended):
   - Pull the PR branch locally and run tests.
4. **Provide Feedback**:
   - Approve if it looks perfect.
   - Request changes if something is wrong.
5. **Monitor Chat**: Participate in the Lobster Hub if workers have architectural questions.

## Principles

- Be strict but constructive.
- Catch bugs before they reach main.
- Ensure every feature has corresponding tests.
`

export function getSoulMd(role: 'master' | 'worker' | 'qa'): string {
  if (role === 'master') return MASTER_SOUL
  if (role === 'qa') return QA_SOUL
  return WORKER_SOUL
}

export function getAgentsMd(role: 'master' | 'worker' | 'qa'): string {
  const roleName = role === 'master' ? 'Master' : (role === 'qa' ? 'QA' : 'Worker')
  return `# AGENTS.md - ${roleName} Lobster Workspace

## Every Session

Before doing anything else:

1. Read SOUL.md - this defines your role
2. Check Gitea for ${role === 'master' ? 'new requirements and Worker PR status' : (role === 'qa' ? 'new PRs to review' : 'assigned Issues to work on')}
3. Read memory/ for recent context if it exists

## Safety

- Don't run destructive commands without thinking
- Don't modify other agents' workspaces
- Ask the Master (via Gitea comments) if requirements are unclear
`
}

export interface OpenClawJsonOptions {
  agentName: string
  role: 'master' | 'worker' | 'qa'
  gatewayToken?: string
  model?: string
  lobbies?: string[]
  feishuConfig?: {
    feishu_enabled?: boolean
    feishu_app_id?: string
    feishu_app_secret?: string
  }
}

export function generateOpenClawJson(opts: OpenClawJsonOptions): Record<string, unknown> {
  const modelStr = opts.model || 'openai|gpt-4o'
  const [providerId, modelId] = modelStr.includes('|') ? modelStr.split('|') : ['openai', modelStr]
  
  const providers = modelsStore.getProviders()
  const provider = providers.find(p => p.id === providerId)

  const gatewayToken = opts.gatewayToken || configStore.get('openclaw.gatewayToken') || ''

  const lobbiesConfig = (opts.lobbies || []).reduce((acc, id) => {
    acc[id] = { enabled: true }
    return acc
  }, {} as Record<string, { enabled: boolean }>)

  // 使用龙虾独立的飞书配置
  const feishuEnabled = opts.feishuConfig?.feishu_enabled === true
  const feishuAppId = opts.feishuConfig?.feishu_app_id
  const feishuAppSecret = opts.feishuConfig?.feishu_app_secret

  const pluginEntries: Record<string, { enabled: boolean }> = {
    lobster: {
      enabled: true
    },
    'lobster-hub': {
      enabled: true
    }
  }

  // 如果启用了飞书，也要在 plugins 中启用
  if (feishuEnabled && feishuAppId && feishuAppSecret) {
    pluginEntries.feishu = {
      enabled: true
    }
  }

  const config: Record<string, unknown> = {
    plugins: {
      entries: pluginEntries
    },
    channels: {
      'lobster-hub': {
        enabled: true,
        hubUrl: 'ws://host.docker.internal:8765/api/hub/ws',
        lobbies: lobbiesConfig,
      }
    },
    agents: {
      defaults: {
        model: {
          primary: `${providerId}/${modelId}`,
        },
        models: {
          [`${providerId}/${modelId}`]: {}
        }
      },
    },
    session: {
      mainKey: 'main',
    },
  }

  if (provider) {
    let apiKey = provider.apiKey
    
    let apiType = provider.api
    // 映射我们定义的 api 类型到 openclaw 支持的类型
    if (apiType === 'openai-compatible' || apiType === 'openai') {
      apiType = 'openai-completions'
    }

    const matchedModel = provider.models?.find(m => m.id === modelId)
    
    const providerConfig: any = {
      baseUrl: provider.baseUrl,
      api: apiType,
      models: [
        {
          id: modelId,
          name: matchedModel?.name || modelId,
          reasoning: false,
          input: ["text"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128000,
          maxTokens: 8192,
        }
      ]
    }

    if (apiKey) {
      providerConfig.apiKey = apiKey
    } else {
      // 如果没有填写 API Key，仍然要生成 apiKey 字段，但是不要用 ${} 环境变量占位符
      // 改用一个默认空字符串，或者直接留空，OpenClaw 会报错但不会因为缺少环境变量配置而崩溃启动不了
      providerConfig.apiKey = 'sk-no-key-provided'
    }

    ;(config as any).models = {
      mode: 'merge',
      providers: {
        [providerId]: providerConfig
      }
    }
  }

  if (gatewayToken) {
    ;(config as any).gateway = { 
      auth: { token: gatewayToken },
      bind: "lan", 
      mode: "local",
      controlUi: { 
        dangerouslyAllowHostHeaderOriginFallback: true,
        dangerouslyDisableDeviceAuth: true,
        allowInsecureAuth: true
      }
    }
  } else {
    ;(config as any).gateway = { 
      bind: "lan",
      mode: "local",
      controlUi: { 
        dangerouslyAllowHostHeaderOriginFallback: true,
        dangerouslyDisableDeviceAuth: true,
        allowInsecureAuth: true
      }
    }
  }

  // 添加飞书配置（如果该龙虾启用了飞书）
  if (feishuEnabled && feishuAppId && feishuAppSecret) {
    ;(config as any).channels.feishu = {
      enabled: true,
      appId: feishuAppId,
      appSecret: feishuAppSecret,
      domain: 'feishu', // 默认中国版
    }
  }

  return config
}
