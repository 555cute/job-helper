import { BaseScraper } from './base.js'

// Boss直聘城市码
const cityCodes = { 北京: '101010100', 上海: '101020100', 深圳: '101280600', 杭州: '101210100', 广州: '101280100', 成都: '101270100', 南京: '101190100', 武汉: '101200100', 西安: '101110100', 苏州: '101190400' }

export class BossScraper extends BaseScraper {
  constructor(config) { super('Boss直聘', config) }

  async search(query) {
    const { keyword, city = '', minSalaryK = 0, maxResults = 30 } = query
    const cityCode = cityCodes[city] || ''
    if (!this.cookie) return []

    try {
      const allJobs = []
      const totalPages = Math.ceil(maxResults / 15)
      const salaryStr = minSalaryK ? `${minSalaryK * 1000},0` : ''

      for (let page = 1; page <= Math.min(totalPages, 3); page++) {
        const url = `https://www.zhipin.com/wapi/zpgeek/search/joblist.json?page=${page}&pageSize=15&query=${encodeURIComponent(keyword)}&city=${cityCode}&salary=${salaryStr}`
        const data = await this.fetchJson(url)
        const list = data?.zpData?.jobList || []
        if (!list.length) break

        allJobs.push(...list.map(item => ({
          title: item.jobName || '', company: item.brandName || '', city: item.cityName || '',
          salary: item.salaryDesc || '', source: 'boss',
          tags: [...(item.skills || []), ...(item.jobLabels || []).slice(0, 5)].filter(Boolean),
          experience: item.jobExperience || '', education: item.jobDegree || '',
          link: `https://www.zhipin.com/job_detail/${item.encryptJobId}.html`,
          jd: (item.jobLabels || []).join('，'),
        })))
      }
      return allJobs.slice(0, maxResults)
    } catch (err) {
      console.warn('[boss]', err.message)
      return []
    }
  }
}
