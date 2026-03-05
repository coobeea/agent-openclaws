# 飞书集成配置指南

## 一、在飞书开放平台创建应用

1. **访问飞书开放平台**
   - 中国版：https://open.feishu.cn/
   - 国际版（Lark）：https://open.larksuite.com/

2. **创建企业自建应用**
   - 登录飞书开放平台
   - 进入「开发者后台」
   - 点击「创建企业自建应用」
   - 填写应用名称和描述

3. **获取凭证信息**
   - 在应用详情页，找到「凭证与基础信息」
   - 复制 **App ID**（格式：`cli_xxxxxxxxxx`）
   - 复制 **App Secret**

4. **配置应用权限**（根据需要）
   - 进入「权限管理」
   - 添加以下权限：
     - `im:message` - 获取与发送单聊、群组消息
     - `im:message.group_msg` - 接收群组消息
     - `im:chat` - 获取群组信息
     - 其他权限根据需要添加

5. **配置事件订阅**（可选，用于接收消息）
   - 进入「事件订阅」
   - 配置请求地址：`http://your-server:port/feishu/webhook`
   - 复制 **Verification Token**
   - 复制 **Encrypt Key**（如果启用了消息加密）
   - 订阅事件：
     - `im.message.receive_v1` - 接收消息

6. **发布应用**
   - 应用开发完成后，提交审核并发布到企业

## 二、在 OpenClaws 中配置

> **注意**：每个龙虾可以配置独立的飞书机器人，一个龙虾对应一个飞书应用。

1. **打开龙虾管理页面**
   - 启动 OpenClaws 应用
   - 点击左侧菜单「智能体管理」
   - 点击「创建龙虾」按钮

2. **填写基本信息**
   - 龙虾名称：例如 `master-001`
   - 选择角色：主龙虾/工龙虾/质检员
   - 选择模型
   - 关联 Gitea 仓库

3. **启用飞书集成**
   - 找到「启用飞书集成」开关，打开它
   - 填写配置信息：
     ```
     飞书 App ID: cli_xxxxxxxxxx (必填)
     飞书 App Secret: *************** (必填)
     ```
   - 域名已内置为 `feishu`（中国版）

4. **创建龙虾**
   - 点击「创建龙虾」按钮
   - 系统会自动生成包含飞书配置的 OpenClaw 配置文件
   - 龙虾启动后即可通过飞书与之交互

## 三、使用飞书与龙虾交互

### 方式 1：直接私聊机器人
1. 在飞书中搜索你的机器人名称
2. 打开与机器人的私聊
3. 发送消息，龙虾会自动回复

### 方式 2：在群组中 @机器人
1. 将机器人添加到飞书群组
2. 在群中 @机器人并发送消息
3. 龙虾会在群中回复

### 方式 3：使用 OpenClaw Tools
龙虾可以使用飞书的各种能力：
- 发送消息到指定群组
- 创建/编辑飞书文档
- 获取群组信息
- 上传文件
- 等等...

## 四、注意事项

1. **网络访问**
   - 飞书 API 需要能够访问外网
   - 如果使用事件订阅，需要配置公网可访问的 webhook 地址

2. **权限申请**
   - 某些敏感权限可能需要企业管理员审批
   - 确保应用已获得必要的权限

3. **配置更新**
   - 飞书配置在创建龙虾时设置，后续修改需要重新创建容器
   - 每个龙虾的飞书配置是独立的，互不影响

4. **调试**
   - 可以在容器日志中查看飞书 API 调用情况：
     ```bash
     docker logs openclaws-master-001 | grep feishu
     ```

## 五、常见问题

### Q: 机器人收不到消息
A: 检查以下几点：
- 应用是否已发布
- 权限是否正确配置
- Verification Token 是否正确
- Webhook 地址是否可访问

### Q: 机器人无法发送消息
A: 检查：
- App ID 和 App Secret 是否正确
- 是否有 `im:message` 权限
- 网络连接是否正常

### Q: 如何查看详细错误
A: 查看容器日志：
```bash
docker exec openclaws-master-001 tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log
```

## 六、相关文档

- [飞书开放平台文档](https://open.feishu.cn/document)
- [OpenClaw 文档](https://docs.openclaw.ai/)
- [飞书机器人开发指南](https://open.feishu.cn/document/home/develop-a-bot-in-5-minutes/create-an-app)
