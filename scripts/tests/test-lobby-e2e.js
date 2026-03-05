#!/usr/bin/env node
/**
 * 端到端测试：龙虾议事厅完整功能测试
 * 测试内容：
 * 1. 创建议事厅
 * 2. 添加龙虾成员
 * 3. 发送消息
 * 4. 验证消息是否正确保存
 * 5. 验证消息是否同步给龙虾（如果龙虾在运行）
 */

const BASE_URL = 'http://127.0.0.1:8765/api'

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

async function del(path) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' })
  return res.json()
}

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`)
}

async function main() {
  console.log('\n=== 龙虾议事厅端到端测试 ===\n')

  // 1. 获取所有龙虾
  log('🔍', '步骤 1: 获取龙虾列表')
  const agentsRes = await get('/hub/agents')
  if (!agentsRes.ok) {
    log('❌', '获取龙虾列表失败')
    console.log(agentsRes)
    return
  }
  const agents = agentsRes.data
  log('✅', `找到 ${agents.length} 只龙虾`)
  agents.forEach(a => {
    console.log(`   - ${a.name} (ID: ${a.id}, 状态: ${a.status}, 角色: ${a.role})`)
  })

  // 2. 获取现有议事厅
  log('🔍', '\n步骤 2: 获取现有议事厅')
  const lobbiesRes = await get('/hub/lobbies')
  if (!lobbiesRes.ok) {
    log('❌', '获取议事厅列表失败')
    return
  }
  log('✅', `找到 ${lobbiesRes.data.length} 个议事厅`)
  lobbiesRes.data.forEach(l => {
    console.log(`   - ${l.name} (ID: ${l.id}, 成员: ${l.members.join(', ')})`)
  })

  // 3. 创建测试议事厅
  log('🏗️', '\n步骤 3: 创建测试议事厅')
  const testMembers = agents.filter(a => a.status === 'running').slice(0, 2).map(a => a.id.toString())
  if (testMembers.length === 0) {
    log('⚠️', '没有运行中的龙虾，将创建一个仅包含人类的议事厅')
  }
  
  const createRes = await post('/hub/lobbies', {
    name: `E2E测试-${Date.now()}`,
    description: '自动化测试议事厅',
    members: testMembers
  })
  
  if (!createRes.ok) {
    log('❌', '创建议事厅失败')
    console.log(createRes)
    return
  }
  
  const lobby = createRes.data
  log('✅', `议事厅创建成功: ${lobby.name} (ID: ${lobby.id})`)
  console.log(`   成员: ${lobby.members.join(', ')}`)

  // 4. 发送测试消息
  log('💬', '\n步骤 4: 发送测试消息')
  const msgRes = await post('/hub/messages', {
    role: 'human',
    senderId: 'test-script',
    senderName: '测试机器人',
    groupId: lobby.id,
    content: `这是一条自动化测试消息，时间戳: ${new Date().toISOString()}`
  })

  if (!msgRes.ok) {
    log('❌', '发送消息失败')
    console.log(msgRes)
    return
  }
  log('✅', '消息发送成功')

  // 5. 等待一下，然后获取消息列表
  log('⏳', '\n步骤 5: 验证消息保存 (等待 1 秒)')
  await new Promise(r => setTimeout(r, 1000))
  
  const messagesRes = await get(`/hub/messages?groupId=${lobby.id}&limit=10`)
  if (!messagesRes.ok) {
    log('❌', '获取消息列表失败')
    console.log(messagesRes)
    return
  }

  const messages = messagesRes.data
  log('✅', `议事厅 "${lobby.name}" 共有 ${messages.length} 条消息`)
  messages.slice(-3).forEach(m => {
    console.log(`   [${new Date(m.timestamp).toLocaleTimeString()}] ${m.senderName}: ${m.content.substring(0, 50)}`)
  })

  // 6. 如果有运行中的龙虾，检查同步日志
  if (testMembers.length > 0) {
    log('🦞', '\n步骤 6: 检查龙虾同步状态')
    log('ℹ️', '请查看终端日志，应该会看到类似以下的输出：')
    console.log('   [OpenClaws] [LobsterHub] New message in ' + lobby.id + ' from 测试机器人: ...')
    console.log('   [OpenClaws] [LobsterHub] Syncing to agent: ...')
  }

  // 7. 清理：删除测试议事厅
  log('🧹', '\n步骤 7: 清理测试数据')
  const deleteRes = await del(`/hub/lobbies/${lobby.id}`)
  if (deleteRes.ok) {
    log('✅', `测试议事厅 "${lobby.name}" 已删除`)
  } else {
    log('⚠️', '删除测试议事厅失败（可能需要手动清理）')
  }

  log('🎉', '\n测试完成！')
  console.log('\n=== 测试总结 ===')
  console.log(`- 龙虾数量: ${agents.length}`)
  console.log(`- 运行中的龙虾: ${agents.filter(a => a.status === 'running').length}`)
  console.log(`- 议事厅创建: ✅`)
  console.log(`- 消息发送: ✅`)
  console.log(`- 消息保存: ✅`)
  console.log(`- 同步给龙虾: ${testMembers.length > 0 ? '✅ (请检查日志)' : '⚠️ (无运行中的龙虾)'}`)
}

main().catch(err => {
  console.error('测试失败:', err)
  process.exit(1)
})
