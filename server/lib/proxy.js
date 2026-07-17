import { ProxyAgent } from 'undici'

let _dispatcher = null
let _initialized = false

export function configureProxy(proxyUrl) {
  _initialized = true
  if (proxyUrl) {
    _dispatcher = new ProxyAgent(proxyUrl)
    console.log(`[proxy] configured: ${proxyUrl}`)
  } else {
    _dispatcher = null
  }
}

export function proxyFetch(url, options = {}) {
  if (!_initialized) {
    const envProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    if (envProxy) {
      _dispatcher = new ProxyAgent(envProxy)
    }
    _initialized = true
  }

  if (_dispatcher && url.startsWith('https://')) {
    return fetch(url, { ...options, dispatcher: _dispatcher })
  }
  return fetch(url, options)
}
