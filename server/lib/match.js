export function resumeText(sections = []) {
  return sections.map((s) => `${s.title}\n${s.content}`).join('\n\n')
}

export function extractKeywords(text = '') {
  return String(text)
    .split(/[,，、\s/|]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}

export function scoreJob(job, resume = [], extraKeywords = []) {
  const blob = resumeText(resume).toLowerCase()
  const keys = [
    ...(job.tags || []),
    ...extractKeywords(job.title || ''),
    ...extractKeywords(job.jd || ''),
    ...extraKeywords,
  ].map((k) => String(k).toLowerCase())

  const unique = [...new Set(keys)].filter(Boolean)
  let hit = 0
  const hits = []
  for (const k of unique) {
    if (blob.includes(k)) {
      hit += 1
      hits.push(k)
    }
  }
  const base = unique.length ? Math.round((hit / unique.length) * 100) : 50
  const bonus =
    (job.tags || []).some((t) => /agent|llm|ai/i.test(t)) && /agent|llm|提示词|工具调用/i.test(blob)
      ? 8
      : 0
  const score = Math.min(99, Math.max(40, base + bonus))
  const reason =
    hits.length > 0
      ? `命中关键词 ${hits.slice(0, 6).join('、')}${hits.length > 6 ? '…' : ''}（${hit}/${unique.length}）`
      : '简历与 JD 关键词重合较少，建议补充目标技能与项目量化'
  return { score, reason, hits }
}

export function recomputeMatches(jobs = [], resume = [], keywords = '') {
  const extra = extractKeywords(keywords)
  return jobs.map((j) => {
    const { score, reason } = scoreJob(j, resume, extra)
    return { ...j, match: score, reason }
  })
}
