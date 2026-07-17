import { uid } from '../lib/id.js'
import { resumeText, scoreJob, recomputeMatches } from '../lib/match.js'
import { analyzeJdAgainstResume } from '../lib/jd.js'
import { buildOptimizeSuggestions, optimizeResumeLocally } from '../lib/agent.js'
import { runJobSearch } from './search/index.js'
import { proxyFetch } from '../lib/proxy.js'
import { parseResumeText, suggestResumeConfig } from '../lib/resumeParser.js'

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'parse_user_resume',
      description: '解析用户提供的简历文本，提取结构化段落、目标岗位、城市、关键词。当用户说"上传简历""分析简历"时调用此工具',
      parameters: {
        type: 'object',
        properties: {
          resume_text: { type: 'string', description: '简历完整文本内容' },
        },
        required: ['resume_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'build_resume_section',
      description: '将用户回答的内容写入简历的某个段落。Agent 应该先通过对话引导用户提供信息，然后调用此工具保存到简历中。每完成一段，告知用户并继续下一段',
      parameters: {
        type: 'object',
        properties: {
          section_title: { type: 'string', description: '段落标题，如"个人信息""求职目标""工作经历""项目经验""技能关键词""教育背景""自我评价"' },
          content: { type: 'string', description: '经过 LLM 润色格式化后的段落内容，使用专业简历语言' },
          replace_all: { type: 'boolean', description: '是否替换同名段落的全部内容' },
        },
        required: ['section_title', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_resume_quality',
      description: '逐段分析简历内容质量，检查缺失量化数据、关键词不匹配等问题，给出具体改进建议',
      parameters: {
        type: 'object',
        properties: {
          target_role: { type: 'string', description: '目标岗位名称' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_jobs',
      description: '检索招聘岗位，从 Boss直聘/智联/猎聘 获取匹配的职位列表',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '搜索关键词，如 React、前端、全栈' },
          city: { type: 'string', description: '城市，如 北京、上海、深圳' },
          min_salary_k: { type: 'number', description: '最低月薪（K），如 25 表示 25K' },
          sources: {
            type: 'array',
            items: { type: 'string', enum: ['boss', 'zhilian', 'liepin'] },
            description: '数据来源',
          },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'optimize_resume',
      description: '根据目标岗位或 JD 给出 3-5 条简历优化建议，可自动写入简历技能段',
      parameters: {
        type: 'object',
        properties: {
          target_role: { type: 'string', description: '目标岗位名称' },
          jd_text: { type: 'string', description: '粘贴的 JD 文本，用于针对性优化' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyze_jd',
      description: '深度分析职位描述(JD)与简历的匹配度，返回匹配分、短板、改进建议和打招呼话术',
      parameters: {
        type: 'object',
        properties: {
          jd_text: { type: 'string', description: '完整的职位描述文本' },
        },
        required: ['jd_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_pipeline',
      description: '查看当前投递跟进状态：收藏数、已投递数、面试中、各阶段岗位分布',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_pitch',
      description: '为指定岗位生成打招呼话术',
      parameters: {
        type: 'object',
        properties: {
          job_title: { type: 'string', description: '岗位名称' },
          company: { type: 'string', description: '公司名称' },
        },
        required: ['job_title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'export_materials',
      description: '导出投递材料包（简历+匹配报告+话术），返回导出说明',
      parameters: {
        type: 'object',
        properties: {
          job_title: { type: 'string', description: '要导出材料的岗位名称' },
        },
      },
    },
  },
]

function buildSystemPrompt(context) {
  const { settings = {}, resume = [], jobs = [] } = context
  const role = settings.resume?.targetRole || '未设置'
  const city = settings.resume?.targetCities || '未设置'
  const salary = settings.resume?.targetSalary || '未设置'

  const jobStats = {
    total: jobs.length,
    starred: jobs.filter((j) => j.starred).length,
    applied: jobs.filter((j) => ['applied', 'interviewing'].includes(j.applyStatus)).length,
    interviewing: jobs.filter((j) => j.applyStatus === 'interviewing').length,
    highMatch: jobs.filter((j) => j.match >= 80).length,
  }

  return [
    '你是求职助手 Agent，内置 4 个专家技能：',
    '',
    '## 1. 简历教练',
    '当用户说"简历教练"或"帮我优化简历"时，自动进入此模式：',
    '- 先询问用户的目标岗位或 JD',
    '- 多轮提问深挖经历（STAR 法则：情境/任务/行动/结果）',
    '- 帮用户生成定制化简历 + 面试策略',
    '- 使用时调用 build_resume_section 逐段保存',
    '',
    '## 2. 职位猎人',
    '当用户说"职位猎人"或"检索岗位"时：',
    '- 先采集求职意向：岗位/行业/城市/薪资/目标企业',
    '- 调用 search_jobs 搜索岗位',
    '- 输出结构化的岗位清单(含匹配度/直达链接/投递优先级)',
    '',
    '## 3. 三方评估',
    '当用户说"三方评估"或"评估简历"时：',
    '- 从 HR/业务 BP/第三方 三个视角独立评测',
    '当用户说"三方评估"或"评估简历"时：',
    '- 从 HR/业务 BP/第三方 三个视角独立评测',
    '- JD 逐条拆解（字面意思+深度解读）',
    '- 给出行业竞争力分析+模拟面试题+强化规划',
    '',
    '## 通用能力',
    '1. 解析简历 — 调用 parse_user_resume 提取结构化段落和目标配置',
    '2. 分析简历质量 — 调用 analyze_resume_quality 逐段检查问题并给出建议',
    '3. 检索岗位 — 调用 search_jobs 从 Boss直聘/智联/猎聘搜索岗位',
    '2. 优化简历 — 调用 optimize_resume 按目标岗位或 JD 产出修改建议',
    '3. 分析 JD — 调用 analyze_jd 深度对比 JD 和简历，给匹配分 + 短板 + 话术',
    '4. 查看跟进 — 调用 check_pipeline 查看投递进度',
    '5. 生成话术 — 调用 generate_pitch 为指定岗位写打招呼文案',
    '6. 导出材料 — 调用 export_materials 说明如何导出投递包',
    '',
    '工作原则：',
    '- 用户说"改简历"→ 先问目标岗位或 JD，再调用 optimize_resume',
    '- 用户说"搜岗位/检索"→ 提取关键词+城市+薪资，调用 search_jobs',
    '- 用户粘贴 JD → 先调用 analyze_jd 分析匹配度，再询问是否需要优化简历',
    '- 回答简洁，分点，给出可执行建议',
    '- 当工具返回结果后，用自然语言总结关键信息给用户',
    '',
    '当前求职配置：',
    `- 目标岗位：${role}`,
    `- 目标城市：${city}`,
    `- 期望薪资：${salary}`,
    '',
    '当前数据概览：',
    `- 岗位总数：${jobStats.total}`,
    `- 收藏：${jobStats.starred}`,
    `- 已投递/面试：${jobStats.applied}`,
    `- 高匹配：${jobStats.highMatch}`,
  ].join('\n')
}

async function callLlmApi(baseUrl, apiKey, model, messages, tools) {
  const timeout = 120000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const body = { model, messages, temperature: 0.4, max_tokens: 2048 }
    if (tools?.length) {
      body.tools = tools
      body.tool_choice = 'auto'
    }
    console.log('[agent] API body keys:', Object.keys(body).join(','), 'has_tools:', !!tools?.length)

    const res = await proxyFetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function executeToolCall(name, args, context) {
  const { resume = [], settings = {}, jobs = [] } = context

  switch (name) {
    case 'build_resume_section': {
      return {
        summary: `已写入简历段落「${args.section_title}」`,
        resume: [{ id: uid('sec'), title: args.section_title || '新段落', content: args.content || '' }],
      }
    }
    case 'parse_user_resume': {
      const text = args.resume_text || ''
      if (!text) return { summary: '请提供简历文本' }
      const sections = parseResumeText(text)
      const config = suggestResumeConfig(text)
      return {
        summary:
          `简历解析完成：\n` +
          `- 识别到 ${sections.length} 个段落\n` +
          `- 目标岗位：${config.targetRole}\n` +
          `- 城市：${config.targetCities}\n` +
          `- 关键词：${config.keywords}`,
        sections,
        config,
      }
    }

    case 'analyze_resume_quality': {
      const suggestions = buildOptimizeSuggestions(resume, settings, args.target_role)
      const sectionList = resume.filter(s => s.content?.trim())
      const issues = []
      for (const s of sectionList) {
        const c = s.content || ''
        if (c.length < 40) issues.push(`· ${s.title} 只有 ${c.length} 字，建议补充`)
        else if (!/\d+%|\d+\s*[倍个次项人月年天周]/.test(c) && c.length > 60)
          issues.push(`· ${s.title} 缺少量化数据支撑`)
      }
      return {
        summary:
          `简历质量分析：\n` +
          `- 共 ${sectionList.length} 个非空段落\n` +
          (issues.length ? `发现 ${issues.length} 个问题：\n${issues.join('\n')}\n` : '') +
          `- 已生成 ${suggestions.length} 条优化建议`,
        suggestions,
      }
    }
    case 'search_jobs': {
      const found = await runJobSearch(
        {
          keyword: args.keyword || settings.search?.defaultKeyword || '前端',
          city: args.city || settings.search?.defaultCity || '北京',
          minSalaryK: args.min_salary_k ?? settings.search?.minSalaryK ?? 20,
          sources: args.sources || ['boss', 'zhilian', 'liepin'],
        },
        { resume, keywords: settings.resume?.keywords || '', maxResults: 10, delayMs: 100 },
      )
      const summary = found.length
        ? `找到 ${found.length} 个岗位：\n` +
          found.slice(0, 5).map((j) => `- [${j.match}分] ${j.title} @${j.company} ${j.city} ${j.salary}`).join('\n')
        : '未找到匹配岗位，请调整搜索条件'
      return { summary, jobs: found }
    }

    case 'optimize_resume': {
      const target = args.target_role || settings.resume?.targetRole || '目标岗位'
      const jdText = args.jd_text || ''
      const suggestions = buildOptimizeSuggestions(resume, settings, target)
      if (jdText) {
        const jdAnalysis = analyzeJdAgainstResume(jdText, resume, settings)
        suggestions.push(...jdAnalysis.suggestions.slice(0, 3))
      }
      const optimized = optimizeResumeLocally(resume, settings, target)
      return {
        summary: `已生成 ${suggestions.length} 条优化建议（目标：${target}）。可在简历页查看和应用。`,
        suggestions,
        resume: optimized,
      }
    }

    case 'analyze_jd': {
      const jdText = args.jd_text || ''
      if (!jdText) return { summary: '请提供完整的 JD 文本' }
      const analysis = analyzeJdAgainstResume(jdText, resume, settings)
      return {
        summary:
          `JD 分析完成：\n` +
          `- 岗位：${analysis.title} @${analysis.company} ${analysis.city} ${analysis.salary}\n` +
          `- 匹配分：${analysis.match}\n` +
          `- 短板：${analysis.gaps.map((g) => `  · ${g}`).join('\n')}\n` +
          `- 建议关键词：${analysis.missingKeywords.join('、') || '无'}`,
        analysis,
      }
    }

    case 'check_pipeline': {
      const byStatus = {}
      for (const j of jobs) {
        const s = j.applyStatus || 'new'
        byStatus[s] = (byStatus[s] || 0) + 1
      }
      const labels = { new: '待投递', saved: '收藏', applied: '已投递', interviewing: '面试中', offer: 'Offer', rejected: '淘汰', archived: '归档' }
      const parts = Object.entries(byStatus).map(([k, v]) => `  · ${labels[k] || k}：${v}`)
      return { summary: `投递跟进状态（共 ${jobs.length} 岗）：\n${parts.join('\n')}` }
    }

    case 'generate_pitch': {
      const job = jobs.find((j) => j.title === args.job_title) ||
        { title: args.job_title, company: args.company || '目标公司', tags: settings.resume?.keywords?.split(',') || [] }
      const tags = (job.tags || []).slice(0, 3).join('、') || '相关技能'
      const pitch = [
        `您好，我是应聘「${job.title}」的候选人，关注到 ${job.company} 的招聘。`,
        `我有 ${tags} 相关落地经验，简历已按 JD 做了针对性优化。`,
        `方便的话想和您简单沟通下团队侧重点与下一步安排，谢谢！`,
      ].join('')
      return { summary: `已生成话术：\n\n${pitch}` }
    }

    case 'export_materials': {
      return {
        summary:
          '导出方式：\n1. 在岗位详情页点「导出材料包」下载 Markdown\n2. 工作台或简历页点「导出」\n3. 对我说"导出全部"触发导出任务\n材料包包含：简历 + 匹配报告 + 打招呼话术 + 备注',
      }
    }

    default:
      return { summary: `未知工具：${name}` }
  }
}

export async function runAgent(userMessage, context = {}) {
  const { settings = {}, resume = [], jobs = [], history = [] } = context
  const agent = settings.agent || {}

  // Mock 模式 / 未配 LLM → 降级到规则逻辑
  if (agent.provider !== 'openai-compatible' || !agent.apiKey || !agent.baseUrl) {
    console.log('[agent] mock mode, reason: provider=', agent.provider, 'hasKey=', !!agent.apiKey, 'hasUrl=', !!agent.baseUrl)
    return runMockAgent(userMessage, context)
  }

  const baseUrl = String(agent.baseUrl).replace(/\/+$/, '')
  const model = agent.model || 'gpt-4o-mini'
  const systemPrompt = buildSystemPrompt(context)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-20).map((m) => ({
      role: m.role === 'agent' ? 'assistant' : m.role,
      content: m.content,
    })),
  ]

  if (resume.length > 0) {
    const resumePreview = resumeText(resume).slice(0, 2000)
    messages.push({
      role: 'system',
      content: `用户当前简历：\n${resumePreview}`,
    })
  }

  messages.push({ role: 'user', content: userMessage })

  const result = {
    reply: '',
    jobs: null,
    suggestions: null,
    resume: null,
    analysis: null,
    sections: null,
    config: null,
    action: null,
  }

  try {
    // First LLM call
    console.log('[agent] calling LLM with', TOOLS.length, 'tools, model:', model, 'baseUrl:', baseUrl.slice(0, 40) + '...')
    let data = await callLlmApi(baseUrl, agent.apiKey, model, messages, TOOLS)
    let choice = data.choices?.[0]
    let toolCalls = choice?.message?.tool_calls
    console.log('[agent] response finish_reason:', choice?.finish_reason, 'tool_calls:', toolCalls?.length || 0)

    // Handle tool calls
    let maxRounds = 3
    while (toolCalls?.length && maxRounds > 0) {
      maxRounds--

      // Add assistant message with tool calls
      messages.push(choice.message)

      // Execute each tool
      for (const tc of toolCalls) {
        const fn = tc.function
        let args = {}
        try {
          args = JSON.parse(fn.arguments)
        } catch { /* ignore */ }

        const toolResult = await executeToolCall(fn.name, args, context)

        // Store tool results in response
        if (toolResult.jobs) result.jobs = toolResult.jobs
        if (toolResult.suggestions) result.suggestions = toolResult.suggestions
        if (toolResult.resume) result.resume = toolResult.resume
        if (toolResult.analysis) result.analysis = toolResult.analysis
        if (toolResult.sections) result.sections = toolResult.sections
        if (toolResult.config) result.config = toolResult.config

        result.action = { type: fn.name, args }

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolResult.summary || '完成',
        })
      }

      // Call LLM again with tool results
      data = await callLlmApi(baseUrl, agent.apiKey, model, messages, TOOLS)
      choice = data.choices?.[0]
      toolCalls = choice?.message?.tool_calls
    }

    result.reply = choice?.message?.content || 'Agent 已执行操作'

    // Fallback: if no reply but we have tool results, generate summary
    if (!result.reply && (result.jobs || result.suggestions || result.analysis)) {
      result.reply = buildFallbackReply(result, context)
    }

    return result
  } catch (err) {
    console.error('[agent] LLM error:', err.message)
    return runMockAgent(userMessage, context)
  }
}

function buildFallbackReply(result, context) {
  const parts = []
  if (result.jobs?.length) {
    parts.push(`检索到 ${result.jobs.length} 个岗位：`)
    result.jobs.slice(0, 5).forEach((j) => parts.push(`- [${j.match}分] ${j.title} @${j.company} ${j.salary}`))
  }
  if (result.suggestions?.length) {
    parts.push(`\n生成 ${result.suggestions.length} 条简历优化建议`)
  }
  if (result.analysis) {
    parts.push(`\nJD 分析：${result.analysis.title}，匹配 ${result.analysis.match} 分`)
  }
  return parts.join('\n') || '已执行操作'
}

function runMockAgent(userMessage, context) {
  const { settings = {}, resume = [], jobs = [] } = context
  const t = String(userMessage).trim().toLowerCase()

  // 尝试识别意图并执行本地逻辑
  if (/(检索|搜索|岗位)\s*(北京|上海|深圳|杭州|广州)/.test(t)) {
    const cityMatch = t.match(/北京|上海|深圳|杭州|广州/)
    const kw = t.replace(/检索|搜索|岗位|一下|帮我|请/g, '').replace(/北京|上海|深圳|杭州|广州/g, '').trim() || '前端'
    const found = jobs.filter((j) =>
      j.title.toLowerCase().includes(kw.toLowerCase()) ||
      j.tags.some((tag) => tag.toLowerCase().includes(kw.toLowerCase())),
    ).slice(0, 8)
    const top = [...found].sort((a, b) => b.match - a.match)
    return {
      reply: top.length
        ? `找到 ${top.length} 个相关岗位：\n${top.slice(0, 5).map((j) => `- [${j.match}分] ${j.title} @${j.company} ${j.city} ${j.salary}`).join('\n')}\n\nMock 模式 | 配置 Agent 可获得更精准结果`
        : '未找到匹配岗位。Mock 模式下数据有限，配置 LLM Agent 可联网检索。',
      jobs: top,
    }
  }

  if (/改|优化|简历/.test(t)) {
    const suggestions = buildOptimizeSuggestions(resume, settings)
    return {
      reply: `已生成 ${suggestions.length} 条优化建议：\n${suggestions.map((s, i) => `${i + 1}. ${s.title}：${s.text}`).join('\n')}\n\nMock 模式 | 配置 OpenAI 兼容 API 可获 LLM 深度分析`,
      suggestions,
    }
  }

  if (/jd|分析|匹配/.test(t) && t.length > 60) {
    const analysis = analyzeJdAgainstResume(userMessage, resume, settings)
    return {
      reply: `JD 分析完成：${analysis.title}，匹配 ${analysis.match} 分\n短板：${analysis.gaps.slice(0, 3).join('；')}`,
      analysis,
    }
  }

  return {
    reply:
      `Mock 模式 | 未配置 LLM\n\n` +
      `你说了：「${userMessage.slice(0, 100)}」\n\n` +
      `你可以：\n` +
      `1. 粘贴完整 JD 让我分析匹配度\n` +
      `2. 说「优化简历」生成建议\n` +
      `3. 说「检索 北京 React 30K+」搜岗位\n` +
      `\n提示：去「设置 → Agent」配置 OpenAI 兼容 API，即可启用完整 AI 对话。`,
  }
}
