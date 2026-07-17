import { extractKeywords, resumeText, scoreJob } from './match.js'
import { uid } from './id.js'

const STOP = new Set([
  '负责', '参与', '熟悉', '精通', '优先', '以上', '工作', '经验', '能力', '以及', '进行', '相关',
  '我们', '公司', '岗位', '职位', '要求', '职责', '描述', '具有', '良好', '团队', '沟通', '协作',
  '本科', '硕士', '学历', '年', '等',
])

export function parseJdText(raw = '') {
  const text = String(raw).trim()
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const first = lines[0] || '未命名岗位'
  let title = first.replace(/^[#*•\-\d.、\s]+/, '').slice(0, 40)
  let company = ''
  let city = ''
  let salary = ''

  const companyLine = lines.find((l) => /公司|employer|company/i.test(l))
  if (companyLine) company = companyLine.replace(/.*(公司|Company)[:：\s]*/i, '').slice(0, 40)
  const cityHit = text.match(/(北京|上海|深圳|杭州|广州|成都|南京|武汉|西安|苏州|全国)/)
  if (cityHit) city = cityHit[1]
  const salaryHit = text.match(/(\d+\s*[-~—]\s*\d+\s*[kK千]|(\d+)\s*[kK千]\+?)/)
  if (salaryHit) salary = salaryHit[0].replace(/\s/g, '')

  const eng = [...text.matchAll(/\b[A-Za-z][A-Za-z0-9.+#-]{1,20}\b/g)].map((m) => m[0])
  const cn = extractKeywords(text.replace(/[^\u4e00-\u9fa5A-Za-z0-9.+#\s,，、]/g, ' '))
  const tags = [
    ...new Set(
      [...eng, ...cn]
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && t.length <= 20 && !STOP.has(t))
        .slice(0, 16),
    ),
  ]

  if (!company) company = '目标公司'
  if (!city) city = '远程/待定'
  if (!salary) salary = '面议'
  return { title, company, city, salary, tags, jd: text }
}

export function analyzeJdAgainstResume(rawJd, resume = [], settings = {}) {
  const parsed = parseJdText(rawJd)
  const pseudo = {
    id: uid('jd'),
    title: parsed.title,
    company: parsed.company,
    city: parsed.city,
    salary: parsed.salary,
    source: 'boss',
    match: 0,
    tags: parsed.tags,
    experience: '',
    education: '',
    updatedAt: '刚刚',
    link: '',
    reason: '',
    jd: parsed.jd,
  }
  const extra = extractKeywords(settings.resume?.keywords || '')
  const { score, reason, hits } = scoreJob(pseudo, resume, extra)
  const blob = resumeText(resume).toLowerCase()
  const missingKeywords = parsed.tags.filter((t) => !blob.includes(String(t).toLowerCase())).slice(0, 8)

  const gaps = []
  if (missingKeywords.length) gaps.push(`缺少 JD 关键词：${missingKeywords.slice(0, 5).join('、')}`)
  if (score < 75) gaps.push('整体匹配偏弱，建议按 JD 改写项目结果与职责表述')
  if (!/性能|指标|%|提升|降低|增长/.test(blob)) gaps.push('缺少可验证量化结果（建议补充 % / 时长 / 规模）')
  if (parsed.tags.some((t) => /agent|llm|ai/i.test(t)) && !/agent|llm|提示词|工具调用/i.test(blob)) {
    gaps.push('JD 偏 AI/Agent，简历侧相关案例不足')
  }
  if (!gaps.length) gaps.push('匹配良好，可进一步强化与该公司业务的关联表述')

  const suggestions = [
    {
      id: uid('sg'),
      title: '对齐岗位标题',
      text: `在个人优势首句点明目标方向「${parsed.title}」，并嵌入：${missingKeywords.slice(0, 4).join('、') || parsed.tags.slice(0, 4).join('、')}`,
      sectionId: 'summary',
    },
    {
      id: uid('sg'),
      title: '补齐缺失关键词',
      text:
        missingKeywords.length > 0
          ? `在技能/项目中自然写入：${missingKeywords.join('、')}`
          : '关键词覆盖较好，保持技术词与业务结果并列出现',
      sectionId: 'skills',
    },
    {
      id: uid('sg'),
      title: '项目结果量化',
      text: '为最相关项目补 1-2 条：动作 → 指标 → 业务影响（如首屏 -35%、转化 +12%）。',
      sectionId: resume.find((s) => /项目|经历/.test(s.title))?.id || 'proj1',
    },
    {
      id: uid('sg'),
      title: '针对 JD 的一句话亮点',
      text: `准备面试开场：我做过与「${parsed.tags.slice(0, 3).join('/')}」直接相关的交付，结果可验证。`,
      sectionId: 'summary',
    },
  ]

  const kws = parsed.tags.slice(0, 3).join('、') || settings.resume?.keywords || '相关技能'
  const pitch = [
    `您好，我是应聘「${parsed.title}」的候选人，关注到 ${parsed.company} 在该方向的招聘。`,
    `我有与 ${kws} 相关的落地经验，当前与岗位匹配约 ${score} 分，简历已按 JD 做了针对性优化。`,
    `方便的话想和您简单沟通下团队侧重点与下一步安排，谢谢！`,
  ].join('')

  const reportMarkdown = [
    `# 岗位匹配报告`,
    ``,
    `- 岗位：${parsed.title}`,
    `- 公司：${parsed.company}`,
    `- 城市：${parsed.city}`,
    `- 薪资：${parsed.salary}`,
    `- 匹配分：${score}`,
    `- 命中：${(hits || []).slice(0, 8).join('、') || '较少'}`,
    ``,
    `## 短板`,
    ...gaps.map((g) => `- ${g}`),
    ``,
    `## 建议补的关键词`,
    missingKeywords.length ? missingKeywords.map((k) => `- ${k}`).join('\n') : '- 无明显缺失',
    ``,
    `## 改写建议`,
    ...suggestions.map((s, i) => `${i + 1}. **${s.title}**：${s.text}`),
    ``,
    `## 打招呼话术`,
    ``,
    pitch,
    ``,
  ].join('\n')

  return {
    title: parsed.title,
    company: parsed.company,
    city: parsed.city,
    salary: parsed.salary,
    tags: parsed.tags,
    match: score,
    reason,
    gaps,
    missingKeywords,
    hits: hits || [],
    suggestions,
    pitch,
    reportMarkdown,
  }
}
