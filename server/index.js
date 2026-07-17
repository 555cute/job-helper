import express from 'express'
import cors from 'cors'
import { uid, nowLabel, nowTime } from './lib/id.js'
import { runJobSearch } from './services/search/index.js'
import { recomputeMatches } from './lib/match.js'
import {
  parseIntent,
  buildOptimizeSuggestions,
  optimizeResumeLocally,
  callLlm,
  mockAgentReply,
  resumeContextMessage,
} from './lib/agent.js'
import { analyzeJdAgainstResume } from './lib/jd.js'
import { parseResumeText, suggestResumeConfig } from './lib/resumeParser.js'
import { runAgent } from './services/agent.js'
import { runInterview } from './services/interview.js'
import { proxyFetch } from './lib/proxy.js'
import { extractTextFromFile } from './lib/fileParser.js'

const PORT = Number(process.env.JOB_HELPER_PORT || 47821)
const app = express()

app.use(cors())
app.use(express.json({ limit: '4mb' }))

/** @type {Map<string, any>} */
const tasks = new Map()

function listTasks() {
  return [...tasks.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

function createTask(partial) {
  const task = {
    id: uid('task'),
    status: 'queued',
    progress: 0,
    summary: '排队中',
    createdAt: nowLabel(),
    updatedAt: nowTime(),
    ...partial,
  }
  tasks.set(task.id, task)
  return task
}

function updateTask(id, patch) {
  const prev = tasks.get(id)
  if (!prev) return null
  const next = { ...prev, ...patch, updatedAt: nowTime() }
  tasks.set(id, next)
  return next
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'job-helper-server',
    version: '1.0.0',
    time: new Date().toISOString(),
    tasks: tasks.size,
  })
})

app.get('/api/tasks', (_req, res) => {
  res.json({ tasks: listTasks() })
})

app.post('/api/tasks/:id/cancel', (req, res) => {
  const task = updateTask(req.params.id, {
    status: 'cancelled',
    summary: '已取消',
    progress: 100,
  })
  if (!task) return res.status(404).json({ error: '任务不存在' })
  res.json({ task })
})

app.delete('/api/tasks', (_req, res) => {
  tasks.clear()
  res.json({ ok: true })
})

app.post('/api/search', async (req, res) => {
  const { query = {}, resume = [], settings = {} } = req.body || {}
  const task = createTask({
    name: `检索 ${query.city || settings.search?.defaultCity || ''} · ${query.keyword || settings.search?.defaultKeyword || ''}`,
    type: 'search',
    status: 'running',
    progress: 20,
    summary: '后端检索中',
  })

  try {
    updateTask(task.id, { progress: 50, summary: '聚合数据源…' })
      const jobs = await runJobSearch(
        {
          keyword: query.keyword ?? settings.search?.defaultKeyword ?? '前端',
          city: query.city ?? settings.search?.defaultCity ?? '北京',
          minSalaryK: query.minSalaryK ?? settings.search?.minSalaryK ?? 25,
          sources: query.sources || ['boss', 'zhilian'].filter(s => settings.sources?.[s]?.enabled !== false),
        },
        {
          resume,
          keywords: settings.resume?.keywords || '',
          maxResults: settings.sources?.maxResults || 30,
          onlyHighMatch: !!settings.search?.onlyHighMatch,
          highMatchThreshold: settings.search?.highMatchThreshold || 80,
          sortBy: settings.search?.sortBy || 'match',
          settings,
        },
      )

    updateTask(task.id, {
      status: 'done',
      progress: 100,
      summary: `命中 ${jobs.length} 条`,
      result: `命中 ${jobs.length} 条`,
    })

    res.json({
      jobs,
      task: tasks.get(task.id),
      mode: settings.sources?.mockMode === false ? 'live-placeholder' : 'mock',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    updateTask(task.id, { status: 'failed', progress: 100, summary: msg, error: msg })
    res.status(500).json({ error: msg, task: tasks.get(task.id) })
  }
})

function buildLocalSuggestions(resume, settings, target) {
  const role = target || settings?.resume?.targetRole || '目标岗位'
  const kws = (settings?.resume?.keywords || '').split(/[,，、]/).filter(Boolean)
  const suggestions = []
  let idx = 0

  for (const s of resume) {
    const content = (s.content || '').trim()
    if (!content) continue
    const hasNumbers = /\d+%|\d+\s*[倍个次项人月年天周]/.test(content)
    const tooShort = content.length < 40

    if (tooShort && idx < 4) {
      suggestions.push({
        id: uid('sg'),
        title: `补充「${s.title}」内容`,
        text: `当前${s.title}只有 ${content.length} 字，建议扩展到至少 80 字，包含：背景 → 行动 → 量化结果。`,
        sectionId: s.id,
      })
      idx++
    }
    if (!hasNumbers && content.length > 60 && idx < 4) {
      suggestions.push({
        id: uid('sg'),
        title: `为「${s.title}」补量化结果`,
        text: `缺少具体数据支撑。建议补充：提升了多少%、覆盖了多大规模、缩短了多少时间等量化指标。`,
        sectionId: s.id,
      })
      idx++
    }
    if ((s.id === 'skills' || s.title.includes('技能')) && idx < 4) {
      const missing = kws.filter((k) => !content.includes(k))
      if (missing.length) {
        suggestions.push({
          id: uid('sg'),
          title: '补齐缺失关键词',
          text: `技能段缺少：${missing.join('、')}。建议在技能或项目描述中嵌入，提高 ATS 匹配分。`,
          sectionId: s.id,
        })
        idx++
      }
    }
  }

  if (suggestions.length < 3) {
    suggestions.push(
      {
        id: uid('sg'),
        title: `明确目标岗位「${role}」`,
        text: `在个人优势首句点明求职方向，让 HR 3 秒内确认意向。`,
        sectionId: resume[0]?.id,
      },
      {
        id: uid('sg'),
        title: '使用 STAR 法则',
        text: '每条经历按情境 → 任务 → 行动 → 结果改写，突出你的个人贡献而非团队描述。',
        sectionId: resume[1]?.id || resume[0]?.id,
      },
    )
  }

  return suggestions.slice(0, 5)
}

app.post('/api/resume/optimize', async (req, res) => {
  const { resume = [], settings = {}, target } = req.body || {}
  const task = createTask({
    name: `简历优化 · ${target || settings.resume?.targetRole || '目标岗位'}`,
    type: 'resume',
    status: 'running',
    progress: 15,
    summary: '分析简历结构…',
  })

  try {
    let suggestions = []
    let source = 'local'

    const agent = settings.agent || {}
    if (agent.provider === 'openai-compatible' && agent.apiKey) {
      try {
        updateTask(task.id, { progress: 40, summary: 'Agent 分析简历…' })
        const result = await runAgent(
          '请分析这份简历的质量，逐段检查问题并给出具体改进建议。',
          { settings, resume, jobs: [], history: [] }
        )
        suggestions = result.suggestions || []
        if (suggestions.length) source = 'llm'
      } catch (err) {
        console.error('[optimize] Agent failed:', err.message)
      }
    }

    if (!suggestions.length) {
      updateTask(task.id, { progress: 60, summary: '本地规则分析…' })
      suggestions = buildLocalSuggestions(resume, settings, target)
    }

    updateTask(task.id, { status: 'done', progress: 100, summary: `生成 ${suggestions.length} 条建议（${source}）` })

    res.json({ suggestions, source, task: tasks.get(task.id) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    updateTask(task.id, { status: 'failed', progress: 100, summary: msg, error: msg })
    res.status(500).json({ error: msg, task: tasks.get(task.id) })
  }
})

app.post('/api/match', async (req, res) => {
  const { jobs = [], resume = [], keywords = '', count = 5 } = req.body || {}
  const task = createTask({
    name: `匹配分析 Top ${count}`,
    type: 'match',
    status: 'running',
    progress: 30,
    summary: '重算匹配分…',
  })
  try {
    const scored = recomputeMatches(jobs, resume, keywords)
    const top = [...scored].sort((a, b) => b.match - a.match).slice(0, count)
    updateTask(task.id, {
      status: 'done',
      progress: 100,
      summary: top.map((j) => `${j.match} ${j.title}`).join('；') || '无岗位',
      result: `Top ${top.length}`,
    })
    res.json({ jobs: scored, top, task: tasks.get(task.id) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    updateTask(task.id, { status: 'failed', progress: 100, summary: msg, error: msg })
    res.status(500).json({ error: msg, task: tasks.get(task.id) })
  }
})

app.post('/api/agent/chat', async (req, res) => {
  const { message = '', resume = [], jobs = [], settings = {}, history = [] } = req.body || {}
  const content = String(message).trim()
  if (!content) return res.status(400).json({ error: 'message 不能为空' })

  const task = createTask({
    name: `Agent 对话`,
    type: 'agent',
    status: 'running',
    progress: 10,
    summary: 'Agent 思考中…',
  })

  try {
    updateTask(task.id, { progress: 30, summary: '调用 LLM…' })
    const result = await runAgent(content, { settings, resume, jobs, history })

    updateTask(task.id, {
      status: 'done',
      progress: 100,
      summary: result.action ? `已执行：${result.action.type}` : '对话完成',
      result: 'Agent 对话完成',
    })

    res.json({
      reply: result.reply,
      action: result.action,
      jobs: result.jobs,
      suggestions: result.suggestions,
      resume: result.resume,
      analysis: result.analysis,
      task: tasks.get(task.id),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    updateTask(task.id, { status: 'failed', progress: 100, summary: msg, error: msg })
    res.status(500).json({ error: msg, task: tasks.get(task.id) })
  }
})

app.post('/api/agent/chat/stream', async (req, res) => {
  const { message = '', resume = [], jobs = [], settings = {} } = req.body || {}
  const content = String(message).trim()
  if (!content) return res.status(400).json({ error: 'message 不能为空' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const agent = settings.agent || {}
  if (agent.provider !== 'openai-compatible' || !agent.apiKey) {
    res.write(`data: ${JSON.stringify({ error: '请先配置 Agent' })}\n\n`)
    res.end()
    return
  }

  try {
    const baseUrl = String(agent.baseUrl).replace(/\/+$/, '')
    const llmRes = await proxyFetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agent.apiKey}`,
      },
      body: JSON.stringify({
        model: agent.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `${agent.systemPrompt || '你是求职助手。'}` },
          { role: 'user', content: `${resumeContextMessage(resume, settings)}\n\n用户：${content}` },
        ],
        stream: true,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!llmRes.ok) {
      res.write(`data: ${JSON.stringify({ error: `LLM ${llmRes.status}` })}\n\n`)
      res.end()
      return
    }

    const reader = llmRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') { res.write(`data: [DONE]\n\n`); break }
        try {
          const chunk = JSON.parse(payload)
          const delta = chunk.choices?.[0]?.delta?.content
          if (delta) {
            fullText += delta
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`)
          }
        } catch { /* skip */ }
      }
      if (buffer === '[DONE]') break
    }

    res.write(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`)
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
  }
  res.end()
})

app.post('/api/agent/test', async (req, res) => {
  const agent = req.body?.agent || {}
  try {
    if (agent.provider === 'mock' || !agent.provider) {
      return res.json({ ok: true, message: 'Mock 模式，无需连接' })
    }
    const reply = await callLlm(
      { ...agent, enabled: true },
      [
        { role: 'system', content: '只回复 OK' },
        { role: 'user', content: 'ping' },
      ],
    )
    res.json({ ok: true, message: `连接成功：${String(reply).slice(0, 80)}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ ok: false, error: msg })
  }
})

app.post('/api/jd/analyze', async (req, res) => {
  const { jd = '', resume = [], settings = {} } = req.body || {}
  const text = String(jd).trim()
  if (!text) return res.status(400).json({ error: 'jd 不能为空' })

  const task = createTask({
    name: 'JD 匹配分析',
    type: 'match',
    status: 'running',
    progress: 20,
    summary: '解析 JD…',
  })

  try {
    updateTask(task.id, { progress: 60, summary: '对比简历…' })
    const analysis = analyzeJdAgainstResume(text, resume, settings)
    updateTask(task.id, {
      status: 'done',
      progress: 100,
      summary: `匹配 ${analysis.match} · ${analysis.title}`,
      result: analysis.reportMarkdown,
    })
    res.json({ analysis, task: tasks.get(task.id) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    updateTask(task.id, { status: 'failed', progress: 100, summary: msg, error: msg })
    res.status(500).json({ error: msg, task: tasks.get(task.id) })
  }
})

app.post('/api/resume/preview', async (req, res) => {
  const { sections = [], settings = {} } = req.body || {}
  if (!sections.length) return res.status(400).json({ error: 'sections 不能为空' })

  const agent = settings?.agent || {}
  if (agent.provider !== 'openai-compatible' || !agent.apiKey) {
    return res.status(400).json({ error: '请先配置 Agent' })
  }

  try {
    // Step 1: Agent 清洗每段内容的换行和格式
    const cleaned = []
    for (const s of sections) {
      const content = s.content || ''
      if (!content.trim()) {
        cleaned.push(s)
        continue
      }

      const cleanResult = await callLlm({ ...agent, enabled: true, maxTokens: 2048 }, [
        {
          role: 'system',
          content: `你是简历排版助手。你的任务是把原始简历文本转为结构化的 HTML 片段。
不要生成完整文档，只返回 <div class="section">...</div> 片段。

规则：
- 原始文本里的 \\n 换行 → <br>
- 两个连续 \\n 之间的内容 → <p>...</p>
- 以 - 或 • 开头的连续行 → <ul><li>...</li></ul>
- 数字、百分比、技术名词 → <span class="hl">数字或名词</span>
- 保留所有原始信息和数据，不要添加或删除`,
        },
        { role: 'user', content: `段落标题：${s.title}\n段落内容：\n${content}` },
      ])

      const fragment = cleanResult
        .replace(/```html?/g, '')
        .replace(/```/g, '')
        .trim()

      cleaned.push({ ...s, content: fragment })
    }

    // Step 2: Agent 生成完整 HTML 简历
    const parts = cleaned
      .map((s) => `<div class="section-title">${s.title === 'name' ? s.content.replace(/<[^>]*>/g, '') : s.title}</div>\n<div class="section-body">${s.content}</div>`)
      .join('\n')

    const html = await callLlm({ ...agent, enabled: true, maxTokens: 4096 }, [
      {
        role: 'system',
        content: `你是简历排版专家。把下面的 section 内容组装成一份精美的 HTML 简历。

要求：
1. 完整 HTML（<!DOCTYPE html> 到 </html>），CSS 在 <style> 中
2. A4 (210×297mm)，页边距 18mm，@page 打印样式
3. 顶部：姓名用 28px 粗体，联系方式用 12px 灰色横排，用竖线分隔
4. 区块标题：14px 粗体+底部 2px 蓝色实线+上方间距 20px
5. .section-title 直接使用传进来的文本，不用修改
6. .section-body 直接使用传进来的 HTML 片段，不用修改
7. 全局字体 13px/1.8，配色 #333
8. .hl 的 CSS：font-weight:600;color:#1d4ed8
9. 左侧留一条连续的灰色时间线（border-left），卡片用浅灰背景
10. 不要修改传入的内容，只需组装排版`,
      },
      { role: 'user', content: parts },
    ])

    const htmlMatch = html.match(/<!DOCTYPE[\s\S]*<\/html>/i)
    res.json({ html: htmlMatch ? htmlMatch[0] : html })
  } catch (err) {
    console.error('[preview]', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/resume/parse-file', async (req, res) => {
  const { file, filename = '', settings: userSettings } = req.body || {}
  if (!file) return res.status(400).json({ error: '请提供文件内容 (base64)' })

  let buffer
  try {
    buffer = Buffer.from(file, 'base64')
  } catch {
    return res.status(400).json({ error: '文件解码失败' })
  }

  const ext = (filename || '').split('.').pop()?.toLowerCase()
  const mimeMap = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
  }
  const mimetype = mimeMap[ext]
  if (!mimetype) return res.status(400).json({ error: `不支持的文件格式: .${ext}` })

  // Video files: no text extraction, just acknowledge
  if (mimetype.startsWith('video/')) {
    const task = createTask({ name: `视频文件`, type: 'resume', status: 'done', progress: 100, summary: '视频文件已记录' })
    return res.json({
      sections: [{ id: 'vid-1', title: '视频文件', content: `${filename} (${(buffer.length / 1024 / 1024).toFixed(1)}MB) — 视频文件不可提取文本，可手动添加备注` }],
      config: null,
      source: 'video',
      task,
    })
  }

  const task = createTask({ name: `解析简历文件`, type: 'resume', status: 'running', progress: 20, summary: '提取文本…' })

  try {
    updateTask(task.id, { progress: 40, summary: '解析文件内容…' })
    const rawText = await extractTextFromFile(buffer, mimetype)
    if (!rawText) {
      updateTask(task.id, { status: 'failed', progress: 100, summary: '文件内容为空', error: '文件内容为空' })
      return res.status(422).json({ error: '文件内容为空或无法识别', task: tasks.get(task.id) })
    }

    updateTask(task.id, { progress: 60, summary: '解析简历结构…' })
    const agentSettings = req.body?.settings?.agent || {}
    const agent = agentSettings

    let sections = []
    let config = null
    let source = 'rule'

    // LLM 路径：严格 JSON 分块
    if (agent.provider === 'openai-compatible' && agent.apiKey) {
      try {
        const jsonText = await callLlm({ ...agent, enabled: true, maxTokens: 2048 }, [
          {
            role: 'system',
            content: `你是简历解析器。将输入文本拆分为结构化段落。

输出纯 JSON（不要\`\`\`json 包裹，不要 markdown，不要任何开头结尾文字）：
{
  "sections": [
    {"title":"个人信息","content":"姓名电话邮箱等"},
    {"title":"求职目标","content":"目标岗位城市薪资"},
    {"title":"教育背景","content":"学校专业时间"},
    {"title":"工作经历","content":"公司职位时间职责"},
    {"title":"项目经验","content":"项目技术栈成果"},
    {"title":"技能关键词","content":"技术名称"},
    {"title":"自我评价","content":"个人优势"}
  ],
  "config": {"targetRole":"岗位","targetCities":"城市","targetSalary":"薪资","keywords":"关键词逗号分隔"}
}

规则：
- 个人信息段：只放姓名电话邮箱地址
- 求职目标段：只放目标岗位城市薪资
- 专业技能全部合并到"技能关键词"段
- 必须拆出至少 4 段，禁止 1 段
- content 纯文本，换行保留 \\n`,
          },
          { role: 'user', content: rawText.slice(0, 10000) },
        ])

        // Try multiple regex patterns
        let jsonStr = ''
        const m1 = jsonText.match(/\{[\s\S]*\}/)
        if (m1) {
          try { JSON.parse(m1[0]); jsonStr = m1[0] } catch {}
        }
        if (!jsonStr) {
          const clean = jsonText.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim()
          const m2 = clean.match(/\{[\s\S]*\}/)
          if (m2) {
            try { JSON.parse(m2[0]); jsonStr = m2[0] } catch {}
          }
        }
        if (!jsonStr) {
          console.error('[parse-file] LLM returned:', jsonText.slice(0, 400))
        }
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr)
          sections = (parsed.sections || []).map((s, i) => ({
            id: `parse-${i}`,
            title: s.title || `段落${i + 1}`,
            content: (s.content || '').replace(/\n{3,}/g, '\n\n'),
          }))
          if (parsed.config) config = parsed.config
          source = 'llm'
        }
      } catch (err) {
        console.error('[parse-file] LLM parse failed:', err.message)
      }
    }

    // 规则兜底
    if (!sections.length) {
      sections = parseResumeText(rawText)
      config = suggestResumeConfig(rawText)
    }

    // 兜底：保证 config 不为空
    if (!config) {
      config = suggestResumeConfig(rawText)
    }

    updateTask(task.id, { status: 'done', progress: 100, summary: `已解析 ${sections.length} 段（${source}）` })

    res.json({ sections, config, source, rawText: rawText.slice(0, 2000), task: tasks.get(task.id) })
  } catch (err) {
    console.error('[parse-file]', err.message)
    const msg = err instanceof Error ? err.message : String(err)
    updateTask(task.id, { status: 'failed', progress: 100, summary: msg, error: msg })
    res.status(500).json({ error: msg, task: tasks.get(task.id) })
  }
})

app.post('/api/resume/parse', async (req, res) => {
  const { text = '', settings = {} } = req.body || {}
  const raw = String(text).trim()
  if (!raw) return res.status(400).json({ error: '简历文本不能为空' })

  const task = createTask({
    name: '解析上传简历',
    type: 'resume',
    status: 'running',
    progress: 20,
    summary: '解析中…',
  })

  try {
    let sections = []
    let config = null
    let source = 'rule'

    const agent = settings.agent || {}
    // 配了真实 LLM 就用 LLM 解析
    if (
      agent.provider === 'openai-compatible' &&
      agent.apiKey &&
      agent.enabled !== false
    ) {
      try {
        updateTask(task.id, { progress: 30, summary: '调用 LLM 解析简历…' })
        const content = await callLlm(agent, [
          {
            role: 'system',
            content:
              '你是一个简历解析器。用户会粘贴简历文本，你返回一个 JSON：\n' +
              '{\n' +
              '  "sections": [{"title":"段落标题","content":"段落内容"}],\n' +
              '  "config": {"targetRole":"目标岗位","targetCities":"北京,上海","targetSalary":"25-40K","keywords":"React,TypeScript"}\n' +
              '}\n' +
              '常见段落：个人优势、工作经历、项目经验、技能关键词、教育背景、证书。\n' +
              '只返回 JSON，不要解释。',
          },
          { role: 'user', content: raw.slice(0, 8000) },
        ])
        // 尝试提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          sections = (parsed.sections || []).map((s, i) => ({
            id: `llm-parse-${i}`,
            title: s.title || `段落${i + 1}`,
            content: s.content || '',
          }))
          config = parsed.config || null
          source = 'llm'
        }
      } catch {
        source = 'rule-fallback'
      }
    }

    if (!sections.length) {
      updateTask(task.id, { progress: 50, summary: '规则解析…' })
      sections = parseResumeText(raw)
      config = suggestResumeConfig(raw)
    }

    updateTask(task.id, {
      status: 'done',
      progress: 100,
      summary: `已解析 ${sections.length} 段（${source}）`,
    })

    res.json({ sections, config, source, task: tasks.get(task.id) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    updateTask(task.id, { status: 'failed', progress: 100, summary: msg, error: msg })
    res.status(500).json({ error: msg, task: tasks.get(task.id) })
  }
})

app.post('/api/interview', async (req, res) => {
  const { message = '', resume = [], job = null, settings = {}, history = [] } = req.body || {}
  if (!message.trim()) return res.status(400).json({ error: 'message 不能为空' })

  try {
    const result = await runInterview({ message, resume, job, settings, history })
    res.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: msg })
  }
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[job-helper-server] http://127.0.0.1:${PORT}`)
})
