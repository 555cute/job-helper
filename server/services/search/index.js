import { uid } from '../../lib/id.js'
import { scoreJob } from '../../lib/match.js'
import { BossScraper } from './boss.js'
import { ZhilianScraper } from './zhilian.js'
import { LiepinScraper } from './liepin.js'

function salaryFloor(s = '') {
  const m = String(s).match(/(\d+)/)
  return m ? Number(m[1]) : 0
}

export async function runJobSearch(query, options = {}) {
  const {
    keyword = '', city = '全国', minSalaryK = 0,
    sources = ['boss', 'zhilian', 'liepin'],
  } = query || {}

  const {
    resume = [], keywords = '',
    maxResults = 30, onlyHighMatch = false,
    highMatchThreshold = 80, sortBy = 'match',
    settings = {},
  } = options

  const src = settings?.sources || {}
  const allJobs = []
  const extraKw = keywords.split(/[,，、\s]+/).filter(Boolean)
  const allowedSources = sources.filter(s => {
    if (s === 'boss') return src.boss?.enabled !== false
    if (s === 'zhilian') return src.zhilian?.enabled !== false
    if (s === 'liepin') return src.liepin?.enabled !== false
    return false
  })

  // 并行查询各平台
  const results = await Promise.allSettled(
    allowedSources.map(async (source) => {
      let scraper
      if (source === 'boss') scraper = new BossScraper(src.boss || {})
      else if (source === 'zhilian') scraper = new ZhilianScraper(src.zhilian || {})
      else scraper = new LiepinScraper(src.liepin || {})

      const q = { keyword, city, minSalaryK, maxResults }
      try {
        return await scraper.search(q)
      } catch {
        return []
      }
    })
  )

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.length) {
      allJobs.push(...r.value.map(j => ({
        ...j, id: uid('job'), updatedAt: '刚刚',
      })))
    }
  }

  // 打分和排序
  const scored = allJobs
    .map(j => {
      const { score, reason } = scoreJob(j, resume, [...extraKw, ...(keyword || '').split(/\s+/)])
      return { ...j, match: score, reason }
    })
    .filter(j => !onlyHighMatch || j.match >= highMatchThreshold)
    .sort((a, b) => sortBy === 'salary' ? salaryFloor(b.salary) - salaryFloor(a.salary) : b.match - a.match)

  return scored.slice(0, maxResults)
}

export function getScraperStatus(settings) {
  const src = settings?.sources || {}
  return {
    boss: { enabled: src.boss?.enabled || false, hasCookie: !!src.boss?.cookie },
    zhilian: { enabled: src.zhilian?.enabled || false, hasCookie: !!src.zhilian?.cookie },
    liepin: { enabled: src.liepin?.enabled || false, hasCookie: !!src.liepin?.cookie },
  }
}
