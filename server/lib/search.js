import { uid } from './id.js'
import { scoreJob } from './match.js'

const seedJobs = []

function salaryFloor(s = '') {
  const m = String(s).match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function runJobSearch(query, options = {}) {
  const {
    keyword = '',
    city = '全国',
    minSalaryK = 0,
    sources = ['boss', 'zhilian', 'liepin'],
  } = query || {}

  const {
    resume = [],
    keywords = '',
    maxResults = 30,
    delayMs = 400,
    onlyHighMatch = false,
    highMatchThreshold = 80,
    sortBy = 'match',
  } = options

  await sleep(Math.min(Math.max(delayMs, 100), 2000))

  const allowed = sources.length ? sources : ['boss', 'zhilian', 'liepin']
  const kw = String(keyword).trim().toLowerCase()
  const extraKw = String(keywords)
    .split(/[,，、\s]+/)
    .filter(Boolean)

  let list = seedJobs
    .filter((j) => allowed.includes(j.source))
    .filter((j) => (city && city !== '全国' ? j.city.includes(city) : true))
    .filter((j) => salaryFloor(j.salary) >= Number(minSalaryK || 0))
    .filter((j) => {
      if (!kw) return true
      return (
        j.title.toLowerCase().includes(kw) ||
        j.company.toLowerCase().includes(kw) ||
        j.tags.some((t) => t.toLowerCase().includes(kw)) ||
        (j.jd || '').toLowerCase().includes(kw)
      )
    })
    .map((j) => {
      const { score, reason } = scoreJob(j, resume, [...extraKw, ...kw.split(/\s+/)])
      return {
        ...j,
        id: uid('job'),
        match: score,
        reason,
        updatedAt: '刚刚',
      }
    })

  if (onlyHighMatch) {
    list = list.filter((j) => j.match >= highMatchThreshold)
  }

  list.sort((a, b) => {
    if (sortBy === 'salary') return salaryFloor(b.salary) - salaryFloor(a.salary)
    return b.match - a.match
  })

  return list.slice(0, maxResults)
}
