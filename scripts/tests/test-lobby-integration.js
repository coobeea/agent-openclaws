#!/usr/bin/env node

/**
 * 龙虾议事厅集成测试脚本
 * 
 * 用法: node test-lobby-integration.js
 * 
 * 前提条件:
 * 1. Electron 应用正在运行 (pnpm run dev)
 * 2. 至少有一只龙虾已创建并启动
 */

const http = require('http')
const WebSocket = require('ws')

const API_BASE = 'http://127.0.0.1:8765'
const WS_URL = 'ws://127.0.0.1:8765/ws'

let testLobbyId = null
let testAgentId = null

// 辅助函数：HTTP 请求
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE)
    const options = {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : {}
    }

    const req = http.request(url, options, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve({ status: res.statusCode, data: json })
        } catch (e) {
          resolve({ status: res.statusCode, data: body })
        }
      })
    })

    req.on('error', reject)
    if (data) req.write(JSON.stringify(data))
    req.end()
  })
}

// 测试步骤
async function runTests() {
  console.log('='.repeat(60))
  console.log('龙虾议事厅集成测试')
  console.log('='.repeat(60))
  console.log()

  try {
    // 1. 检查 API 可达性
    console.log('[1/8] 检查 API 服务器...')
    const healthRes = await request('GET', '/api/hub/lobbies')
    if (healthRes.status !== 200) {
      throw new Error(`API 服务器不可达 (状态码: ${healthRes.status})`)
    }
    console.log('✅ API 服务器正常\n')

    // 2. 获取现有龙虾
    console.log('[2/8] 获取龙虾列表...')
    const agentsRes = await request('GET', '/gateway/api/agents.list')
    if (!agentsRes.data.ok || agentsRes.data.data.length === 0) {
      throw new Error('没有可用的龙虾，请先创建并启动龙虾')
    }
    const runningAgent = agentsRes.data.data.find(a => a.status === 'running')
    if (!runningAgent) {
      throw new Error('没有正在运行的龙虾，请先启动至少一只龙虾')
    }
    testAgentId = runningAgent.id.toString()
    console.log(`✅ 找到运行中的龙虾: ${runningAgent.name} (ID: ${testAgentId})\n`)

    // 3. 创建测试议事厅
    console.log('[3/8] 创建测试议事厅...')
    const createRes = await request('POST', '/api/hub/lobbies', {
      name: '集成测试议事厅',
      description: '自动化测试专用',
      members: [testAgentId]
    })
    if (!createRes.data.ok) {
      throw new Error(`创建议事厅失败: ${JSON.stringify(createRes.data)}`)
    }
    testLobbyId = createRes.data.data.id
    console.log(`✅ 议事厅创建成功 (ID: ${testLobbyId})\n`)

    // 4. 等待龙虾连接 WebSocket
    console.log('[4/8] 等待龙虾连接到 WebSocket...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    console.log('✅ 等待完成\n')

    // 5. 发送测试消息
    console.log('[5/8] 发送测试消息...')
    const msgRes = await request('POST', '/api/hub/messages', {
      role: 'human',
      senderId: 'test-script',
      senderName: '测试脚本',
      groupId: testLobbyId,
      content: '你好，龙虾！请回复这条消息以确认你能收到。'
    })
    if (!msgRes.data.ok) {
      throw new Error(`发送消息失败: ${JSON.stringify(msgRes.data)}`)
    }
    const testMessageId = msgRes.data.data.id
    console.log(`✅ 消息发送成功 (ID: ${testMessageId})\n`)

    // 6. 等待龙虾回复
    console.log('[6/8] 等待龙虾回复...')
    let replyReceived = false
    let attempts = 0
    const maxAttempts = 20 // 40秒超时

    while (attempts < maxAttempts && !replyReceived) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      attempts++

      const pollRes = await request('GET', `/api/hub/messages?groupId=${testLobbyId}&limit=50`)
      if (pollRes.data.ok) {
        const messages = pollRes.data.data
        const replies = messages.filter(m => 
          m.id > testMessageId && 
          m.senderId === testAgentId &&
          m.groupId.toString() === testLobbyId.toString()
        )
        
        if (replies.length > 0) {
          replyReceived = true
          console.log(`✅ 收到龙虾回复: "${replies[0].content.substring(0, 50)}..."\n`)
        } else {
          process.stdout.write(`   等待中... (${attempts * 2}s)\r`)
        }
      }
    }

    if (!replyReceived) {
      console.log(`⚠️  超时未收到龙虾回复 (等待了 ${attempts * 2}s)`)
      console.log('   可能原因:')
      console.log('   - 龙虾的 AI 模型配置错误')
      console.log('   - 龙虾未正确连接到 WebSocket')
      console.log('   - Channel Plugin 未正确加载')
      console.log('   请查看 Docker 容器日志: docker logs <container_name>\n')
    }

    // 7. 测试 WebSocket 连接
    console.log('[7/8] 测试前端 WebSocket 连接...')
    const ws = new WebSocket(WS_URL)
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('WebSocket 连接超时'))
      }, 5000)

      ws.on('open', () => {
        clearTimeout(timeout)
        ws.send(JSON.stringify({
          type: 'subscribe',
          agentId: 'test-frontend',
          agentName: '测试前端',
          lobbies: [testLobbyId]
        }))

        setTimeout(() => {
          ws.close()
          console.log('✅ WebSocket 连接成功\n')
          resolve()
        }, 1000)
      })

      ws.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    // 8. 清理测试议事厅
    console.log('[8/8] 清理测试数据...')
    await request('DELETE', `/api/hub/lobbies/${testLobbyId}`)
    console.log('✅ 测试议事厅已删除\n')

    // 测试总结
    console.log('='.repeat(60))
    if (replyReceived) {
      console.log('✅ 所有测试通过！龙虾议事厅工作正常。')
    } else {
      console.log('⚠️  部分测试失败，请查看上述错误信息。')
    }
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    console.error('\n请检查:')
    console.error('1. Electron 应用是否正在运行 (pnpm run dev)')
    console.error('2. 是否有龙虾正在运行')
    console.error('3. HubServer WebSocket 是否已初始化')
    console.error('4. Docker 容器是否能访问 host.docker.internal:8765')
    
    if (testLobbyId) {
      console.error('\n清理测试数据...')
      await request('DELETE', `/api/hub/lobbies/${testLobbyId}`).catch(() => {})
    }
    
    process.exit(1)
  }
}

// 运行测试
runTests()
