# 求职助手 (Job Helper)

AI 驱动的求职桌面应用，集 Agent 对话、简历创建、多平台岗位检索、投递跟进 Pipeline 于一体。

## 功能

| 模块 | 说明 |
|------|------|
| **Agent 对话** | 内置 3 个专家技能（简历教练 / 职位猎人 / 三方评估），支持 LLM 工具调用，可上传 PDF/图片/Word 文件 |
| **简历管理** | Agent 对话式创建简历，逐段引导，支持 STAR 法则和 ATS 关键词优化 |
| **岗位检索** | 一键搜索 Boss直聘 / 智联 / 猎聘 3 个平台，匹配度打分，勾选加入 Pipeline |
| **投递 Pipeline** | 6 列看板管理（收藏/待投递/已投递/面试中/Offer/淘汰），支持拖拽和筛选 |
| **模拟面试** | AI 面试官逐题提问、回答核实、追问和评估报告 |
| **工作台** | 粘贴 JD → 一键分析匹配度、短板、推荐话术、应用到简历 |

## 技术栈

- **前端**: React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- **桌面**: Electron
- **后端**: Express 5 + Node.js
- **LLM**: OpenAI Compatible API（支持 opencode.ai / OpenAI / Ollama 等）
- **文件解析**: pdfjs-dist (PDF) + mammoth (DOCX) + tesseract.js (OCR)

## 快速启动

```bash
# 安装依赖
npm install

# 启动桌面端（三端同时：后端 + 前端 + Electron）
npm run dev:desktop

# 或分别启动
npm run dev          # Web 前端 + 后端
npm run dev:server   # 仅后端
npm run dev:web      # 仅前端
```

- 前端：`http://127.0.0.1:5173`
- 后端：`http://127.0.0.1:47821`

## 配置 Agent

1. 打开设置 → Agent
2. Provider 选择 `OpenAI Compatible`
3. 填入 Base URL 和 API Key
4. 点击「测试连接」验证

支持的 API：
- [opencode.ai](https://opencode.ai) — 免费额度
- OpenAI / Ollama / 其他兼容接口

## 岗位检索配置

1. 设置 → 数据源 → 对目标平台点击「获取 Cookie」
2. 在弹出的登录窗口完成登录，Cookie 自动填入
3. 去检索页输入关键词+城市，点击检索

## 项目结构

```
job-helper/
├── electron/          # Electron 主进程
├── server/            # Express 后端
│   ├── lib/           # 工具库（解析、匹配、代理）
│   └── services/      # 服务层（Agent、面试、搜索）
│       └── search/    # Boss/智联/猎聘 爬虫
├── src/               # React 前端
│   ├── components/    # 通用组件
│   ├── pages/         # 页面
│   ├── lib/           # 前端工具
│   └── state/         # 全局状态
└── scripts/           # 辅助脚本
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/search` | 多平台岗位检索 |
| POST | `/api/agent/chat` | Agent 对话（含工具调用） |
| POST | `/api/agent/test` | 测试 LLM 连接 |
| POST | `/api/resume/parse-file` | 解析简历文件（PDF/DOCX/图片） |
| POST | `/api/resume/preview` | 生成简历 HTML 预览 |
| POST | `/api/resume/optimize` | 简历优化建议 |
| POST | `/api/interview` | 模拟面试 |
| POST | `/api/jd/analyze` | JD 分析 |
| GET  | `/api/tasks` | 任务列表 |

## License

MIT
