export function parseResumeText(raw = '') {
  const text = String(raw).trim()
  if (!text) return []

  // 按常见简历标题分段
  const headings = [
    '个人优势', '技能', '工作经历', '项目经验', '项目', '教育', '证书',
    '自我评价', '求职意向', '基本信息', '联系方式', '语言', '获奖',
    '实习经历', '校园经历', '社团', '开源', '博客', '个人作品',
  ]
  const pattern = new RegExp(
    `(?:^|\\n)(?:#+\\s*|【|■|[一二三四五六七八九十]+[、.]\\s*|\\d+[.、]\\s*)?(${headings.join('|')})[：:]*\\s*\\n`,
    'gi',
  )

  const parts = []
  let lastIdx = 0
  let match = null

  const re = new RegExp(pattern.source, 'gi')
  while ((match = re.exec(text)) !== null) {
    if (lastIdx < match.index && parts.length === 0) {
      // 第一个标题前的内容作为个人优势
      const before = text.slice(lastIdx, match.index).trim()
      if (before) {
        parts.push({ title: '个人优势', content: before })
      }
    }
    if (parts.length > 0) {
      const prev = parts[parts.length - 1]
      prev.content = text.slice(lastIdx, match.index).trim()
    }
    lastIdx = match.index + match[0].length
    parts.push({ title: match[1].trim(), content: '' })
  }

  if (parts.length > 0) {
    parts[parts.length - 1].content = text.slice(lastIdx).trim()
  } else {
    // 没有标题 → 按空行分块
    const blocks = text
      .split(/\n{2,}/)
      .map((b) => b.trim())
      .filter(Boolean)
    if (blocks.length === 1) {
      parts.push({ title: '简历正文', content: blocks[0] })
    } else {
      for (let i = 0; i < blocks.length; i++) {
        parts.push({
          title: i === 0 ? '个人优势' : i === blocks.length - 1 ? '技能' : `段落 ${i + 1}`,
          content: blocks[i],
        })
      }
    }
  }

  // 合并短段落、去空
  const merged = []
  for (const p of parts) {
    const content = p.content.trim()
    if (!content) continue
    const prev = merged[merged.length - 1]
    if (prev && prev.content.length < 40 && content.length < 40) {
      prev.title += ` + ${p.title}`
      prev.content += '\n' + content
    } else {
      merged.push({ title: p.title, content })
    }
  }

  return merged.map((p, i) => ({
    id: `res-parse-${i}`,
    title: p.title,
    content: p.content,
  }))
}

export function suggestResumeConfig(text = '') {
  const lower = text.toLowerCase()
  const roles = []
  if (/前端|frontend|react|vue/i.test(lower)) roles.push('前端工程师')
  if (/后端|backend|java|go|python|node/i.test(lower)) roles.push('后端工程师')
  if (/全栈|full.?stack/i.test(lower)) roles.push('全栈工程师')
  if (/算法|机器学习|deep.?learning/i.test(lower)) roles.push('算法工程师')
  if (/产品|product/i.test(lower)) roles.push('产品经理')
  if (/设计|design|ui|ux/i.test(lower)) roles.push('设计师')
  if (!roles.length) roles.push('工程师')

  const cityHit = text.match(/(北京|上海|深圳|杭州|广州|成都|南京|武汉)/)
  const salaryHit = text.match(/薪资[：:]*\s*(\d+[-~—]\d+\s*[kK千])/)

  return {
    targetRole: roles[0],
    targetCities: cityHit?.[1] || '北京',
    targetSalary: salaryHit?.[1] || '20-35K',
    keywords: [...text.matchAll(/\b[A-Z][A-Za-z0-9.+#-]{2,20}\b/g)]
      .map((m) => m[0])
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 8)
      .join(','),
  }
}
