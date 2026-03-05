#!/bin/bash

echo "=== 龙虾调试工具 ==="
echo ""

CONTAINER="openclaws-master-001"

# 检查容器是否运行
if ! docker ps | grep -q "$CONTAINER"; then
  echo "❌ 容器 $CONTAINER 未运行"
  exit 1
fi

echo "✅ 容器 $CONTAINER 正在运行"
echo ""

echo "1️⃣ 检查环境变量"
echo "---"
docker exec $CONTAINER env | grep -E "(AGENT|LOBSTER|HUB)" || echo "⚠️ 未找到相关环境变量"
echo ""

echo "2️⃣ 检查 openclaw.json 配置"
echo "---"
docker exec $CONTAINER cat /home/node/.openclaw/openclaw.json | grep -A 5 "plugins" || echo "⚠️ 未找到 plugins 配置"
echo ""

echo "3️⃣ 检查可用工具列表"
echo "---"
docker exec $CONTAINER sh -c "cat /home/node/.openclaw/openclaw.json | grep -o 'lobster' | wc -l" | xargs -I {} echo "lobster 出现 {} 次"
echo ""

echo "4️⃣ 查看最近的日志（搜索 lobster）"
echo "---"
docker logs $CONTAINER --tail 50 2>&1 | grep -i "lobster" || echo "⚠️ 日志中未找到 lobster 相关内容"
echo ""

echo "5️⃣ 查看最近的日志（搜索 chat）"
echo "---"
docker logs $CONTAINER --tail 50 2>&1 | grep -i "chat" | tail -10
echo ""

echo "6️⃣ 测试 HubServer 连通性（从容器内）"
echo "---"
docker exec $CONTAINER sh -c "curl -s http://host.docker.internal:8765/api/hub/lobbies | head -100" || echo "❌ 无法连接到 HubServer"
echo ""

echo "7️⃣ 检查 WebSocket 连接"
echo "---"
docker logs $CONTAINER --tail 100 2>&1 | grep -E "(ws|websocket|connect)" | tail -5
echo ""

echo "=== 调试建议 ==="
echo ""
echo "如果 LOBSTER_HUB_URL 缺失："
echo "  → 需要重启龙虾容器（在前端点击「重启」）"
echo ""
echo "如果 lobster 插件未启用："
echo "  → 检查 openclaw.json 中 plugins.entries.lobster.enabled 是否为 true"
echo ""
echo "如果日志中有 'closed before connect'："
echo "  → WebSocket 握手失败，检查 syncToAgents 代码是否正确发送 connect 请求"
echo ""
echo "如果龙虾收到消息但不回复："
echo "  → 可能是 AI 决定不回复，或者 lobster_chat 工具调用失败"
echo "  → 进入容器查看详细日志：docker exec -it $CONTAINER sh"
echo ""
