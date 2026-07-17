import { BaseScraper } from './base.js'

export class LiepinScraper extends BaseScraper {
  constructor(config) { super('猎聘', config) }

  async search(query) {
    const { keyword, city = '', maxResults = 30 } = query
    if (!this.cookie) return []

    try {
      const allJobs = []
      const totalPages = Math.ceil(maxResults / 15)
      for (let page = 0; page < Math.min(totalPages, 3); page++) {
        const params = new URLSearchParams({ key: keyword, dqs: city, curPage: String(page), pageSize: '15' })
        const data = await this.fetchJson(`https://www.liepin.com/api/com.liepin.searchfront4c.pc-search-job?${params}`)
        const list = data?.data?.jobCardList || []
        if (!list.length) break
        allJobs.push(...list.map(j => ({
          title: j.job?.title || '', company: j.comp?.compName || '', city: j.job?.dqs || '',
          salary: j.job?.salary || '', source: 'liepin',
          tags: (j.job?.labels || []).slice(0, 8),
          experience: j.job?.requireWorkYears || '', education: j.job?.requireEduLevel || '',
          link: j.job?.url || '', jd: j.job?.requirement || '',
        })))
      }
      return allJobs.slice(0, maxResults)
    } catch (err) {
      console.warn('[liepin]', err.message)
      return []
    }
  }
}
