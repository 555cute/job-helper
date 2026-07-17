import { resumeText } from './match.js'
import { uid } from './id.js'
import { proxyFetch } from './proxy.js'

export function parseIntent(input = '') {
  const t = String(input).trim()
  const lower = t.toLowerCase()

  // 长文本 + JD 特征 → 分析 JD
  if (
    t.length > 80 &&
    /(岗位职责|任职要求|职位描述|job description|requirements|我们希望|加分项)/i.test(t)
  ) {
    return { type: 'analyze_jd', jd: t }
  }

  if (/导出|export|材料包/.test(t)) return { type: 'export' }

  if (/话术|打招呼|开场白|沟通文案/.test(t)) return { type: 'pitch' }

  if (/收藏|跟进|投递状态|面试/.test(t)) return { type: 'pipeline' }

  if (/匹配|对比|短板|打分|分析\s*jd|解析\s*jd/i.test(t)) {
    const m = t.match(/(\d+)/)
    if (/jd|职位描述|岗位职责/i.test(t) || t.length > 60) {
      return { type: 'analyze_jd', jd: t }
    }
    return { type: 'match_top', count: m ? Number(m[1]) : 5 }
  }

  if (/简历|优化|改写|润色/.test(t)) {
    const target = t.replace(/.*(优化|改写|润色)/, '').trim() || undefined
    return { type: 'optimize_resume', target }
  }

  if (/检索|搜索|岗位|职位|boss|智联|猎聘|zhipin|zhaopin/.test(lower)) {
    const cityMatch = t.match(/(北京|上海|深圳|杭州|广州|成都|全国|[一-龥]{2,3}市?)/)
    const salaryMatch = t.match(/(\d+)\s*[kK千]/)
    const sources = []
    if (/boss|直聘/.test(lower)) sources.push('boss')
    if (/智联|zhilian|zhaopin/.test(lower)) sources.push('zhilian')
    if (/猎聘|liepin/.test(lower)) sources.push('liepin')

    let keyword = t
      .replace(/检索|搜索|岗位|职位|一下|帮我|请/g, ' ')
      .replace(/boss|直聘|智联|猎聘/gi, ' ')
      .replace(/(北京|上海|深圳|杭州|广州|成都|全国)/g, ' ')
      .replace(/\d+\s*[kK千]\+?/g, ' ')
      .replace(/[·•,，]/g, ' ')
      .trim()
    if (!keyword) keyword = '前端'

    return {
      type: 'search',
      keyword,
      city: cityMatch?.[1],
      minSalaryK: salaryMatch ? Number(salaryMatch[1]) : undefined,
      sources: sources.length ? sources : undefined,
    }
  }

  return { type: 'none' }
}

export function buildOptimizeSuggestions(resume = [], settings = {}, target) {
  const role = target || settings?.resume?.targetRole || '目标岗位'
  const kws = settings?.resume?.keywords || 'React,TypeScript'
  return [
    {
      id: uid('sg'),
      title: `对齐「${role}」`,
      text: `在个人优势首句点明目标岗位「${role}」，并嵌入关键词：${kws}`,
      sectionId: 'summary',
    },
    {
      id: uid('sg'),
      title: '项目量化',
      text: '为每个项目补充：背景 → 动作 → 结果（指标/百分比/时长）。',
      sectionId: resume.find((s) => /项目/.test(s.title))?.id,
    },
    {
      id: uid('sg'),
      title: '技能可检索',
      text: `技能段改为逗号分隔且与 JD 一致：${kws}`,
      sectionId: 'skills',
    },
    {
      id: uid('sg'),
      title: `语气：${settings?.resume?.tone || 'professional'}`,
      text:
        settings?.resume?.tone === 'concise'
          ? '每段控制在 3 行内，删除形容词堆砌。'
          : settings?.resume?.tone === 'impact'
            ? '每条经历以动词开头，突出 ownership 与业务影响。'
            : '保持专业书面语，避免口语与空泛软技能。',
      sectionId: 'exp1',
    },
  ]
}

export function optimizeResumeLocally(sections = [], settings = {}, target) {
  const role = target || settings?.resume?.targetRole || '目标岗位'
  const kws = settings?.resume?.keywords || ''
  return sections.map((s) => {
    if (s.id === 'summary') {
      return {
        ...s,
        content: `面向${role}：${String(s.content).replace(/^面向.*?：/, '')}\n关键词：${kws}`,
      }
    }
    if (s.id === 'skills') {
      const merged = [
        ...new Set(
          [...String(s.content).split(/[,，、\s]+/), ...String(kws).split(/[,，、\s]+/)].filter(Boolean),
        ),
      ]
      return { ...s, content: merged.join(', ') }
    }
    if (/项目|经历/.test(s.title) && !/【优化】/.test(s.content)) {
      return {
        ...s,
        content: `${s.content}\n\n【优化】补充可验证结果，并与「${role}」JD 关键词对齐。`,
      }
    }
    return s
  })
}

export async function callLlm(agentSettings, messages) {
  if (!agentSettings?.enabled) throw new Error('Agent 已关闭')
  if (agentSettings.provider === 'mock') throw new Error('MOCK')

  const baseUrl = String(agentSettings.baseUrl || '').replace(/\/+$/, '')
  if (!baseUrl) throw new Error('未配置 Base URL')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), agentSettings.timeoutMs || 60000)
  try {
    const res = await proxyFetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(agentSettings.apiKey ? { Authorization: `Bearer ${agentSettings.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: agentSettings.model || 'gpt-4o-mini',
        temperature: agentSettings.temperature ?? 0.4,
        max_tokens: agentSettings.maxTokens || 2048,
        messages,
        stream: false,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) throw new Error('LLM 返回为空')
    return String(content)
  } finally {
    clearTimeout(timer)
  }
}

export function mockAgentReply(input, action, ctx = {}) {
  const settings = ctx.settings || {}
  if (action.type === 'optimize_resume') {
    return `已创建简历优化任务${action.target ? `（目标：${action.target}）` : ''}。\n• 语气：${settings.resume?.tone || 'professional'}\n• 目标岗位：${settings.resume?.targetRole || '-'}\n• 已返回优化建议，可在「简历」页应用。`
  }
  if (action.type === 'search') {
    return `已编排检索任务：\n• 关键词：${action.keyword || settings.search?.defaultKeyword || '前端'}\n• 城市：${action.city || settings.search?.defaultCity || '北京'}\n• 最低薪：${action.minSalaryK ?? settings.search?.minSalaryK ?? 25}K\n• 来源：${(action.sources || ['boss', 'zhilian']).join('/')}\n• 后端已完成检索并返回岗位列表。`
  }
  if (action.type === 'match_top') {
    const top = [...(ctx.jobs || [])].sort((a, b) => b.match - a.match).slice(0, action.count || 5)
    if (!top.length) return '暂无岗位数据，请先检索。'
    const lines = top.map((j, i) => `${i + 1}. [${j.match}] ${j.title} · ${j.company} — ${j.reason}`)
    return `匹配分析（Top ${top.length}）：\n${lines.join('\n')}`
  }
  if (action.type === 'export') {
    return `导出请求已记录。可在岗位详情导出「投递材料包」，或顶栏导出全部（格式：${settings.export?.defaultFormat || 'markdown'}）。`
  }
  if (action.type === 'analyze_jd') {
    return '已识别为 JD 分析请求。请在工作台粘贴 JD 使用「一键匹配改简历」，或继续让我按该 JD 改简历。'
  }
  if (action.type === 'pitch') {
    return '可在岗位详情点击「生成话术」并复制。话术会结合匹配分与关键词生成。'
  }
  if (action.type === 'pipeline') {
    const starred = (ctx.jobs || []).filter((j) => j.starred).length
    const applied = (ctx.jobs || []).filter((j) =>
      ['applied', 'interviewing', 'offer'].includes(j.applyStatus),
    ).length
    return `当前跟进：收藏 ${starred} · 已投/面试 ${applied}。可在岗位列表改状态、写备注、导出材料包。`
  }
  return `已收到：「${input.slice(0, 80)}${input.length > 80 ? '…' : ''}」\n可尝试：\n1. 粘贴完整 JD 让我分析\n2. 优化简历\n3. 检索 Boss 北京前端 30K+\n4. 对比前 5 个岗位\n当前 Provider：${settings.agent?.provider || 'mock'}`
}

export function resumeContextMessage(resume = [], settings = {}) {
  return `目标岗位：${settings.resume?.targetRole || ''}\n城市：${settings.resume?.targetCities || ''}\n薪资：${settings.resume?.targetSalary || ''}\n关键词：${settings.resume?.keywords || ''}\n语气：${settings.resume?.tone || ''}\n\n简历：\n${resumeText(resume)}`
}
