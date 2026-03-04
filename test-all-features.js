#!/usr/bin/env node

/**
 * OpenClaws 功能全面测试脚本
 * 测试所有核心功能是否正常工作
 */

const http = require('http');

const BASE_URL = 'http://127.0.0.1:8765';

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  reset: '\x1b[0m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : {}
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    log(`✅ ${name}`, 'green');
    return true;
  } catch (err) {
    log(`❌ ${name}: ${err.message}`, 'red');
    return false;
  }
}

async function main() {
  log('\n=== OpenClaws 功能测试 ===\n', 'blue');

  let passed = 0;
  let failed = 0;

  // 1. 测试议事厅 API
  log('📋 议事厅功能测试', 'yellow');
  
  if (await test('获取议事厅列表', async () => {
    const res = await request('GET', '/api/hub/lobbies');
    if (!res.data.ok) throw new Error('API 返回失败');
    log(`   找到 ${res.data.data.length} 个议事厅`, 'blue');
  })) passed++; else failed++;

  if (await test('获取议事厅消息', async () => {
    const res = await request('GET', '/api/hub/messages?groupId=1&limit=5');
    if (!res.data.ok) throw new Error('API 返回失败');
    log(`   找到 ${res.data.data.length} 条消息`, 'blue');
  })) passed++; else failed++;

  if (await test('发送测试消息', async () => {
    const res = await request('POST', '/api/hub/messages', {
      role: 'system',
      senderId: 'test',
      senderName: '测试脚本',
      groupId: '1',
      content: '这是一条自动化测试消息'
    });
    if (!res.data.ok) throw new Error('发送失败');
  })) passed++; else failed++;

  // 2. 测试任务 API (通过 WebSocket Gateway)
  log('\n📋 任务功能测试（跳过，需要 WebSocket）', 'yellow');
  log('   ⏭️  任务 API 需要通过 WebSocket 测试', 'blue');

  // 3. 测试系统状态
  log('\n📋 系统状态测试', 'yellow');
  
  if (await test('检查服务器响应', async () => {
    const res = await request('GET', '/api/hub/lobbies');
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
  })) passed++; else failed++;

  // 4. 测试成员管理
  log('\n📋 成员管理测试', 'yellow');

  if (await test('查看议事厅成员', async () => {
    const res = await request('GET', '/api/hub/lobbies');
    if (!res.data.ok) throw new Error('获取失败');
    const lobby = res.data.data[0];
    if (lobby) {
      log(`   议事厅"${lobby.name}"有 ${lobby.members.length} 位成员`, 'blue');
    }
  })) passed++; else failed++;

  // 总结
  log('\n=== 测试总结 ===', 'blue');
  log(`通过: ${passed}`, 'green');
  log(`失败: ${failed}`, 'red');
  log(`总计: ${passed + failed}\n`, 'blue');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  log(`测试执行失败: ${err.message}`, 'red');
  process.exit(1);
});
