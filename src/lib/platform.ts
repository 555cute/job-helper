import type { JobPost, ResumeSection, SourceKey } from '../types'
import { uid } from './id'

export type InterviewQuestion = {
  id: string
  category: 'common' | 'technical' | 'behavioral' | 'counter'
  question: string
  hint: string
  sampleAnswer: string
}

export type InterviewPrep = {
  jobTitle: string
  company: string
  platformNotes: string
  resumeHighlights: string[]
  questions: InterviewQuestion[]
  closingTips: string[]
}

interface PlatformRules {
  label: string
  /** 简历前置格式建议 */
  headerFormat: string
  /** 关键词侧重 */
  keywordBias: string[]
  /** 长度建议 */
  lengthHint: string
  /** 沟通风格 */
  toneHint: string
  /** JD 常见结构 */
  jdPattern: string
}

export const PLATFORM_RULES: Record<SourceKey, PlatformRules> = {
  boss: {
    label: 'Boss直聘',
    headerFormat: '姓名 · 岗位 · 工作年限（一行）',
    keywordBias: ['技术栈', '业务指标', '项目年限'],
    lengthHint: '在线简历：简洁有力，500 字以内；附件可用详细版',
    toneHint: '直接、结果导向，每段开头用动词',
    jdPattern: '岗位职责 ▸ 任职要求 ▸ 加分项',
  },
  zhilian: {
    label: '智联招聘',
    headerFormat: '姓名 · 求职意向（城市·行业·薪资）',
    keywordBias: ['学历', '证书', '公司背景', '稳定性'],
    lengthHint: '在线简历字段完整，工作经历按公司分段，每段 3-5 条',
    toneHint: '正式、结构化，用「负责…」「主导…」开头',
    jdPattern: '工作职责 ▸ 任职资格 ▸ 公司介绍',
  },
  liepin: {
    label: '猎聘',
    headerFormat: '姓名 · 职位 · 城市 · 工作年限',
    keywordBias: ['管理经验', '项目规模', '团队人数', '行业认知'],
    lengthHint: '强调项目深度与领导力，社招偏好 800-1200 字',
    toneHint: '专业自信，用「主导」「引领」「负责 XX 人团队」',
    jdPattern: '职位描述 ▸ 任职要求 ▸ 我们提供',
  },
}

function highlightResume(sections: ResumeSection[]) {
  return sections.slice(0, 3).map((s) => {
    const firstLine = s.content.split('\n')[0]?.slice(0, 60) || ''
    return `· ${s.title}：${firstLine}`
  })
}

export function buildInterviewPrep(
  job: JobPost,
  resume: ResumeSection[],
): InterviewPrep {
  const rules = PLATFORM_RULES[job.source] || PLATFORM_RULES.boss
  const tags = job.tags || []
  const techTags = tags.filter((t) => /[A-Z]/.test(t[0]) || /react|vue|node|java|python|ai|llm|sql|docker|k8s|linux|cloud|api|微服务|高并发/i.test(t))
  const softTags = tags.filter((t) => !/[A-Z]/.test(t[0]) && !/react|vue|node|java|python|ai|llm|sql|docker|k8s|linux|cloud|api|微服务|高并发/i.test(t))

  const questions: InterviewQuestion[] = [
    {
      id: uid('q'),
      category: 'common',
      question: '请做一个简单的自我介绍',
      hint: '控制在 2 分钟内，结构化：我是谁 + 我做过什么 + 为什么申请',
      sampleAnswer: `我目前专注于 ${job.title} 方向，${resume[0]?.content.slice(0, 80) || '有相关项目经验'}。关注到 ${job.company} 在该领域的布局，希望加入并推动 ${tags.slice(0, 2).join('、')} 相关落地。`,
    },
    {
      id: uid('q'),
      category: 'common',
      question: '为什么想来我们公司 / 这个岗位',
      hint: '结合公司业务、岗位挑战、个人成长',
      sampleAnswer: `我对 ${job.company} 在 ${tags.slice(0, 2).join('、')} 方向的积累很关注。${job.title} 岗位的职责和我的技术栈（${techTags.slice(0, 3).join('、')}）高度匹配，尤其想参与 ${job.jd?.slice(0, 40) || '相关业务'}的落地。`,
    },
    {
      id: uid('q'),
      category: 'technical',
      question: `请讲一个与 ${techTags[0] || '核心技术'} 相关的项目`,
      hint: 'STAR 法：背景 → 任务 → 行动 → 结果（量化）',
      sampleAnswer: `背景：公司需要提升 ${techTags[0] || '核心功能'} 的稳定性。我的角色是 ${job.title.split(' ')[0] || '开发'}。我做了：1) 重构请求层减少 35% 首屏耗时 2) 引入 ${techTags[1] || '新技术'} 解决痛点。结果：P75 从 2.8s 降至 1.8s，支撑了 XX 万 DAU。`,
    },
    {
      id: uid('q'),
      category: 'technical',
      question: techTags.length > 1
        ? `你怎么理解 ${techTags[1] || '相关技术'} 在实际业务中的应用`
        : '你最近学习了什么新技术，为什么',
      hint: '联系业务场景，展现学习深度',
      sampleAnswer: `在实际业务中我用 ${techTags[1] || techTags[0] || 'React'} 解决了 ${softTags[0] || '性能优化'} 问题。具体做法是先分析瓶颈数据，再引入对应工具，最后验证指标改善。`,
    },
    {
      id: uid('q'),
      category: 'behavioral',
      question: '描述一次你推动的跨团队协作或冲突解决',
      hint: '展现沟通、ownership、结果',
      sampleAnswer: `在某次项目中，设计与开发对交互方案有分歧。我主动组织了方案评审，列出两种方案的优劣和成本，最终说服团队采用折中方案，上线后指标提升 12%。`,
    },
    {
      id: uid('q'),
      category: 'behavioral',
      question: '你最大的缺点是什么，如何改善',
      hint: '讲真实缺点 + 已采取的改进措施 + 成果',
      sampleAnswer: `我过去在需求不明确时容易过早动工。后来我推动团队采用「先写 RFC/设计文档再 coding」的流程，现在项目平均工期缩短了 15%。`,
    },
    {
      id: uid('q'),
      category: 'counter',
      question: '你还有什么问题想问我们',
      hint: `展现对 ${job.company} 和岗位的理解，不要问薪资福利`,
      sampleAnswer: `1) 团队目前的 ${tags[0] || '技术'} 栈是怎样的，有什么演进规划？\n2) 入职后前 3 个月的重点目标是什么？\n3) 团队规模和分工是怎样的？`,
    },
  ]

  return {
    jobTitle: job.title,
    company: job.company,
    platformNotes: `${rules.label} 沟通风格：${rules.toneHint}。JD 常见结构：${rules.jdPattern}。`,
    resumeHighlights: highlightResume(resume),
    questions,
    closingTips: [
      `提前了解 ${job.company} 的最新产品/融资/新闻`,
      `带上 1-2 个可以展示的线上项目或 GitHub`,
      `准备反问：团队规模、技术栈、近期重点`,
      `面后 4 小时内发感谢消息，提及面试中讨论的一个点`,
    ],
  }
}

export function platformResumeTweak(
  sections: ResumeSection[],
  source: SourceKey,
): ResumeSection[] {
  const rules = PLATFORM_RULES[source] || PLATFORM_RULES.boss

  return sections.map((s) => {
    let content = s.content
    if (s.id === 'summary' || /优势/.test(s.title)) {
      content = content.replace(/^面向[^：]*[：:]\s*/gm, '')
      if (!content.startsWith(rules.toneHint)) {
        content = `【${rules.label} 优化】${content}`
      }
    }
    return { ...s, content }
  })
}

export function exportInterviewPrep(prep: InterviewPrep): string {
  const md = [
    `# 面试准备 · ${prep.jobTitle} @ ${prep.company}`,
    ``,
    `> ${prep.platformNotes}`,
    ``,
    `## 简历亮点`,
    ...prep.resumeHighlights.map((h) => h),
    ``,
    `## 模拟问答`,
    ...prep.questions.map(
      (q) =>
        `### Q: ${q.question}\n\n**提示**：${q.hint}\n\n**你可以这样回答**：\n${q.sampleAnswer}\n`,
    ),
    `## 面后 Tips`,
    ...prep.closingTips.map((t) => `- ${t}`),
    ``,
  ].join('\n')

  const prefix = 'job-helper-interview'
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const safe = `${prep.company}-${prep.jobTitle}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 30)
  const filename = `${prefix}-${safe}-${stamp}.md`

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return filename
}
