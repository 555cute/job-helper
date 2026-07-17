import { proxyFetch } from '../../lib/proxy.js'
import { uid } from '../../lib/id.js'

export class BaseScraper {
  constructor(name, config = {}) {
    this.name = name
    this.config = config
    this.cookie = config.cookie || ''
    this.enabled = config.enabled || false
  }

  get headers() {
    const h = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/html, */*',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    }
    if (this.cookie) h['Cookie'] = this.cookie
    return h
  }

  async fetchJson(url, opts = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), opts.timeout || 15000)
    try {
      const res = await proxyFetch(url, {
        ...opts,
        signal: controller.signal,
        headers: { ...this.headers, ...opts.headers },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  async search(query) {
    throw new Error(`${this.name}: search() not implemented`)
  }
}
