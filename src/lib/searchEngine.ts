import type { AppSettings, JobPost, ResumeSection, SourceKey } from '../types'

export type SearchQuery = {
  keyword: string
  city: string
  minSalaryK: number
  sources: SourceKey[]
}

export function enabledSources(settings: AppSettings): SourceKey[] {
  const keys: SourceKey[] = []
  if (settings.sources.boss.enabled) keys.push('boss')
  if (settings.sources.zhilian.enabled) keys.push('zhilian')
  if (settings.sources.liepin.enabled) keys.push('liepin')
  return keys
}

export async function runJobSearch(
  query: SearchQuery,
  settings: AppSettings,
  resume: ResumeSection[],
): Promise<JobPost[]> {
  await sleep(settings.sources.requestIntervalMs)

  const allowed = query.sources.filter((s) => {
    if (s === 'boss') return settings.sources.boss.enabled
    if (s === 'zhilian') return settings.sources.zhilian.enabled
    return settings.sources.liepin.enabled
  })

  if (!allowed.length) {
    throw new Error('没有启用的数据源，请到设置中开启 Boss/智联/猎聘')
  }

  // 浏览器端通过后端代理搜索
  const { api } = await import('./api')
  const data = await api.search({ query, resume, settings })
  return data.jobs || []
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, Math.min(Math.max(ms, 200), 3000)))
}
