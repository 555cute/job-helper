import type { AppSettings, ChatMessage, JobPost, ResumeSection, ResumeSuggestion } from '../types'
import { resumeText } from './match'
import { uid, nowTime } from './id'

export type AgentAction =
  | { type: 'none' }
  | { type: 'optimize_resume'; target?: string }
  | {
      type: 'search'
      keyword?: string
      city?: string
      minSalaryK?: number
      sources?: Array<'boss' | 'zhilian' | 'liepin'>
    }
  | { type: 'match_top'; count?: number }
  | { type: 'export' }

export function parseIntent(input: string): AgentAction {
  const t = input.trim()
  const lower = t.toLowerCase()

  if (/导出|export/.test(t)) return { type: 'export' }

  if (/匹配|对比|短板|打分/.test(t)) {
    const m = t.match(/(\d+)/)
    return { type: 'match_top', count: m ? Number(m[1]) : 5 }
  }

  if (/简历|优化|改写|润色/.test(t)) {
    const target = t.replace(/.*(优化|改写|润色)/, '').trim() || undefined
    return { type: 'optimize_resume', target }
  }

  if (/检索|搜索|岗位|职位|boss|智联|猎聘|zhipin|zhaopin/.test(lower)) {
    const cityMatch = t.match(/(北京|上海|深圳|杭州|广州|成都|全国|[一-龥]{2,3}市?)/)
    const salaryMatch = t.match(/(\d+)\s*[kK千]/)
    const sources: Array<'boss' | 'zhilian' | 'liepin'> = []
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

export function mockAgentReply(
  input: string,
  action: AgentAction,
  ctx: { jobs: JobPost[]; resume: ResumeSection[]; settings: AppSettings },
): string {
  if (action.type === 'optimize_resume') {
    return `已创建简历优化任务${action.target ? `（目标：${action.target}）` : ''}。\n• 语气：${ctx.settings.resume.tone}\n• 目标岗位：${ctx.settings.resume.targetRole}\n• 将写入优化建议，可在「简历」页一键应用。`
  }
  if (action.type === 'search') {
    const src =
      action.sources?.join('/') ||
      [
        ctx.settings.sources.boss.enabled && 'Boss',
        ctx.settings.sources.zhilian.enabled && '智联',
        ctx.settings.sources.liepin.enabled && '猎聘',
      ]
        .filter(Boolean)
        .join('/')
    return `已编排检索任务：\n• 关键词：${action.keyword || ctx.settings.search.defaultKeyword}\n• 城市：${action.city || ctx.settings.search.defaultCity}\n• 最低薪：${action.minSalaryK ?? ctx.settings.search.minSalaryK}K\n• 来源：${src || '无（请在设置启用）'}`
  }
  if (action.type === 'match_top') {
    const top = [...ctx.jobs].sort((a, b) => b.match - a.match).slice(0, action.count || 5)
    if (!top.length) return '暂无岗位数据，请先检索。'
    const lines = top.map(
      (j, i) => `${i + 1}. [${j.match}] ${j.title} · ${j.company} — ${j.reason}`,
    )
    return `匹配分析（Top ${top.length}）：\n${lines.join('\n')}\n\n共性短板：量化结果、LLM 评估指标；建议在项目段补充可验证数据。`
  }
  if (action.type === 'export') {
    return `导出格式默认：${ctx.settings.export.defaultFormat}。请到任务中心或工作台执行导出。`
  }
  return `已收到：「${input}」\n可尝试：优化简历 / 检索 Boss 北京前端 30K+ / 对比前 5 个岗位。\n当前 Provider：${ctx.settings.agent.provider} · 模型：${ctx.settings.agent.model}`
}

export async function callLlm(
  settings: AppSettings,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
): Promise<string> {
  if (!settings.agent.enabled) throw new Error('Agent 已在设置中关闭')
  if (settings.agent.provider === 'mock') throw new Error('MOCK')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), settings.agent.timeoutMs)
  try {
    const res = await fetch(`${settings.agent.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(settings.agent.apiKey ? { Authorization: `Bearer ${settings.agent.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: settings.agent.model,
        temperature: settings.agent.temperature,
        max_tokens: settings.agent.maxTokens,
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

export function buildOptimizeSuggestions(
  resume: ResumeSection[],
  settings: AppSettings,
  target?: string,
): ResumeSuggestion[] {
  const role = target || settings.resume.targetRole
  const kws = settings.resume.keywords
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
      title: `语气：${settings.resume.tone}`,
      text:
        settings.resume.tone === 'concise'
          ? '每段控制在 3 行内，删除形容词堆砌。'
          : settings.resume.tone === 'impact'
            ? '每条经历以动词开头，突出 ownership 与业务影响。'
            : '保持专业书面语，避免口语与空泛软技能。',
      sectionId: 'exp1',
    },
  ]
}

export function applySuggestionToResume(
  sections: ResumeSection[],
  suggestion: ResumeSuggestion,
): ResumeSection[] {
  const sid = suggestion.sectionId || sections[0]?.id
  return sections.map((s) =>
    s.id === sid ? { ...s, content: `${s.content.trim()}\n\n【优化】${suggestion.text}` } : s,
  )
}

export function optimizeResumeLocally(
  sections: ResumeSection[],
  settings: AppSettings,
  target?: string,
): ResumeSection[] {
  const role = target || settings.resume.targetRole
  const kws = settings.resume.keywords
  return sections.map((s) => {
    if (s.id === 'summary') {
      return {
        ...s,
        content: `面向${role}：${s.content.replace(/^面向.*?：/, '')}\n关键词：${kws}`,
      }
    }
    if (s.id === 'skills') {
      const merged = [...new Set([...s.content.split(/[,，、\s]+/), ...kws.split(/[,，、\s]+/)].filter(Boolean))]
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

export function resumeContextMessage(resume: ResumeSection[], settings: AppSettings) {
  return `目标岗位：${settings.resume.targetRole}\n城市：${settings.resume.targetCities}\n薪资：${settings.resume.targetSalary}\n关键词：${settings.resume.keywords}\n语气：${settings.resume.tone}\n\n简历：\n${resumeText(resume)}`
}

export function toChat(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: uid('msg'), role, content, time: nowTime() }
}
