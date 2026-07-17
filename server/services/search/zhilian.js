import { BaseScraper } from './base.js'

const cityCodes = { 北京: '530', 上海: '538', 深圳: '763', 杭州: '653', 广州: '765', 成都: '801', 南京: '635', 武汉: '736', 西安: '854', 苏州: '731' }

export class ZhilianScraper extends BaseScraper {
  constructor(config) { super('智联招聘', config) }

  async search(query) {
    const { keyword, city = '', maxResults = 30 } = query
    if (!this.cookie) return []

    try {
      const allJobs = []
      const totalPages = Math.ceil(maxResults / 15)
      for (let page = 1; page <= Math.min(totalPages, 3); page++) {
        const data = await this.fetchJson('https://www.zhaopin.com/sou/jobs5.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Referer': 'https://www.zhaopin.com/sou/' },
          body: JSON.stringify({
            kw: keyword, cityId: cityCodes[city] || '',
            workExperience: -1, education: -1,
            pageIndex: page, pageSize: 15,
          }),
        })
        const list = data?.data?.results || []
        if (!list.length) break
        allJobs.push(...list.map(j => ({
          title: j.jobName || '', company: j.companyName || '', city: j.cityDisplay || '',
          salary: j.salary || '', source: 'zhilian',
          tags: (j.jobLabelList || []).slice(0, 8),
          experience: j.workExperience || '', education: j.education || '',
          link: j.positionURL || '', jd: j.jobDesc || '',
        })))
      }
      return allJobs.slice(0, maxResults)
    } catch (err) {
      console.warn('[zhilian]', err.message)
      return []
    }
  }
}
