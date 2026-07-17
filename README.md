# 求职助手（桌面端）

Agent 驱动改简历 + Boss/智联岗位检索工具。

## 启动

### Web + 后端
```bash
npm install
npm run dev
```
- 前端：http://127.0.0.1:5173  
- 后端：http://127.0.0.1:47821  

### 桌面端（Electron）
```bash
npm install
npm run dev:desktop
```

### 仅后端
```bash
npm run dev:server
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/search` | 岗位检索 |
| POST | `/api/resume/optimize` | 简历优化 |
| POST | `/api/match` | 匹配打分 |
| POST | `/api/agent/chat` | Agent 对话 |
| POST | `/api/agent/test` | 测试 LLM 连接 |
| GET | `/api/tasks` | 任务列表 |

## 说明

- 默认检索为 **Mock 聚合**（浏览器/本地可直接跑通）。
- 在设置中配置 OpenAI Compatible Base URL + API Key 可走真实 LLM。
- Boss/智联真实抓取需合规接入（官方 API / 自建 worker），当前已预留 Cookie 配置位。
