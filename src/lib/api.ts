const DEFAULT_BASE = 'http://127.0.0.1:47821'

export function getApiBase() {
  const fromWindow =
    typeof window !== 'undefined'
      ? (window as unknown as { jobHelperDesktop?: { apiBase?: string } }).jobHelperDesktop?.apiBase
      : undefined
  return (
    fromWindow ||
    (import.meta.env.VITE_API_BASE as string | undefined) ||
    DEFAULT_BASE
  ).replace(/\/+$/, '')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `API ${res.status}`)
  }
  return data as T
}

export const api = {
  health: () => request<{ ok: boolean; service: string; version: string }>('/api/health'),
  search: (body: unknown) => request<{ jobs: any[]; task: any; mode: string }>('/api/search', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  optimizeResume: (body: unknown) =>
    request<{ suggestions: any[]; resume: any[]; source: string; task: any }>(
      '/api/resume/optimize',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  match: (body: unknown) =>
    request<{ jobs: any[]; top: any[]; task: any }>('/api/match', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  agentChat: (body: unknown) =>
    request<{
      reply: string
      action: any
      jobs?: any[]
      suggestions?: any[]
      resume?: any[]
      top?: any[]
      analysis?: any
      task: any
    }>('/api/agent/chat', { method: 'POST', body: JSON.stringify(body) }),

  agentChatStream: (body: unknown) =>
    fetch(`${getApiBase()}/api/agent/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  testAgent: (agent: unknown) =>
    request<{ ok: boolean; message?: string; error?: string }>('/api/agent/test', {
      method: 'POST',
      body: JSON.stringify({ agent }),
    }),
  listTasks: () => request<{ tasks: any[] }>('/api/tasks'),
  cancelTask: (id: string) =>
    request<{ task: any }>(`/api/tasks/${id}/cancel`, { method: 'POST' }),
  clearTasks: () => request<{ ok: boolean }>('/api/tasks', { method: 'DELETE' }),
  analyzeJd: (body: unknown) =>
    request<{ analysis: any; task?: any }>('/api/jd/analyze', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  parseResume: (body: unknown) =>
    request<{ sections: any[]; config: any; task?: any }>('/api/resume/parse', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  parseResumeFile: (file: string, filename: string, settings?: unknown) =>
    request<{ sections: any[]; config: any; rawText?: string; task?: any }>('/api/resume/parse-file', {
      method: 'POST',
      body: JSON.stringify({ file, filename, settings }),
    }),
  interview: (body: unknown) =>
    request<{ reply: string; stage: string; round: number }>('/api/interview', {
      method: 'POST', body: JSON.stringify(body),
    }),
  resumePreview: (body: unknown) =>
    request<{ html: string }>('/api/resume/preview', {
      method: 'POST', body: JSON.stringify(body),
    }),
}
