import { proxyFetch } from '../lib/proxy.js'
import { resumeText } from '../lib/match.js'
import { uid } from '../lib/id.js'

const INTERVIEW_SYSTEM = `你是一位专业、友善的技术面试官。你的任务是：

1. 根据求职者的简历和目标岗位，进行一场模拟面试
2. 面试分为三个阶段：
   - 开场（1-2 个问题）：自我介绍、求职动机
   - 技术考察（3-5 个问题）：根据简历中的技能点和岗位要求提问，逐步深入
   - 行为面试（2-3 个问题）：项目经验、团队协作、问题解决
   - 收尾：请用户提问，然后给出综合评价
3. 每轮问一个问题，等待用户回答后再问下一个
4. 用户回答后，简短点评（鼓励为主 + 1 条改进建议），然后问下一个问题
5. 全部问题结束后，给出：
   - 总体评分（1-10）
   - 亮点
   - 改进建议（3 条）
   - 推荐表达方式（2 条）

风格要求：
- 像真人面试官一样自然对话
- 不一次性抛出所有问题
- 点评要具体，引用用户回答中的内容
- 全程使用中文`

function buildContextMessage(resume, job) {
  let context = ''

  if (resume?.length > 0) {
    context += `## 求职者简历\n${resumeText(resume).slice(0, 3000)}\n\n`
  }

  if (job) {
    context += `## 目标岗位\n`
    context += `职位：${job.title}\n公司：${job.company}\n`
    context += `城市：${job.city}\n薪资：${job.salary}\n`
    context += `标签：${(job.tags || []).join('、')}\n`
    if (job.jd) context += `JD：${job.jd.slice(0, 1000)}\n`
    context += '\n'
  }

  if (!job && resume?.length > 0) {
    // 从简历中提取目标岗位
    const text = resumeText(resume)
    const roleMatch = text.match(/目标岗位[：:]\s*(.+?)[\n,，]/)
    if (roleMatch) context += `目标岗位：${roleMatch[1]}\n\n`
  }

  return context
}

async function callInterviewLlm(settings, messages) {
  const agent = settings?.agent || {}
  if (agent.provider !== 'openai-compatible' || !agent.apiKey) {
    throw new Error('CONFIG_MISSING')
  }

  const baseUrl = String(agent.baseUrl).replace(/\/+$/, '')
  const model = agent.model || 'gpt-4o-mini'

  const res = await proxyFetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${agent.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 2048,
      messages,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`LLM ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('LLM 返回为空')
  return String(content)
}

export async function runInterview({ message, resume, job, settings, history = [] }) {
  const agent = settings?.agent || {}

  // Mock 模式 / 未配 LLM
  if (agent.provider !== 'openai-compatible' || !agent.apiKey) {
    return runMockInterview(message, resume, job, history)
  }

  const context = buildContextMessage(resume, job)
  const stageHint = getStageHint(history.length)

  const messages = [
    { role: 'system', content: INTERVIEW_SYSTEM },
    {
      role: 'system',
      content: `${context}面试阶段提示：${stageHint}\n当前第 ${history.length + 1} 轮对话，请只问一个问题，等待回答。`,
    },
    ...history.map((m) => ({
      role: m.role === 'interviewer' ? 'assistant' : 'user',
      content: m.content,
    })),
    { role: 'user', content: message },
  ]

  try {
    const reply = await callInterviewLlm(settings, messages)
    return {
      reply,
      stage: stageHint,
      round: history.length + 1,
    }
  } catch (err) {
    // LLM 调用失败 → Mock 模式
    return runMockInterview(message, resume, job, history)
  }
}

function getStageHint(round) {
  if (round <= 1) return '开场阶段：请用户自我介绍'
  if (round <= 5) return '技术考察阶段：深入问技术问题'
  if (round <= 8) return '行为面试阶段：问项目经验和软技能'
  return '收尾阶段：请用户提问，然后给出总结评价'
}

function runMockInterview(message, resume, job, history) {
  const round = history.length
  const qaList = [
    { q: '请简单介绍一下你自己，以及你为什么对这个岗位感兴趣？', hint: '开场阶段：请自我介绍' },
    {
      q: `你在简历中提到${resume[0]?.content?.slice(0, 30) || '相关经验'}，能详细说说你最满意的一个项目吗？遇到了什么挑战，怎么解决的？`,
      hint: '技术考察阶段',
    },
    {
      q: `如果让你用${job?.tags?.[0] || '核心技术'}设计一个新系统，你会考虑哪些方面？`,
      hint: '技术考察阶段',
    },
    { q: '你有没有处理过线上紧急故障？当时怎么应对的？', hint: '行为面试阶段' },
    { q: '你在团队协作中遇到过不同意见吗？怎么处理的？', hint: '行为面试阶段' },
    { q: '如果让你给自己在这次面试中的表现打分，你会打几分？为什么？', hint: '收尾阶段' },
    {
      q: '你有什么问题想问我吗？\n\n---\n\n## 面试总结\nMock 模式 | 未配置 LLM\n\n总体评分：7/10\n\n亮点：准备充分，项目经验清晰\n\n改进建议：\n1. 多用具体数据支撑观点\n2. STAR 法则回答行为问题\n3. 提前研究目标公司业务',
      hint: '',
    },
  ]

  const idx = Math.min(round, qaList.length - 1)
  const qa = qaList[idx]

  return {
    reply: qa.q,
    stage: qa.hint || getStageHint(round),
    round: round + 1,
  }
}
