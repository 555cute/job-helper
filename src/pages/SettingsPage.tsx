import { useState } from 'react'
import { defaultSettings } from '../data/defaults'
import { useApp } from '../state/AppContext'
import { isDesktopApp } from '../lib/desktop'
import { uid } from '../lib/id'
import type { AgentSkill, AppSettings, McpServer, SourceKey } from '../types'

type SectionKey =
  | 'general'
  | 'appearance'
  | 'agent'
  | 'sources'
  | 'search'
  | 'resume'
  | 'tasks'
  | 'export'
  | 'privacy'
  | 'data'

const sections: { key: SectionKey; label: string }[] = [
  { key: 'general', label: '通用' },
  { key: 'appearance', label: '外观' },
  { key: 'agent', label: 'Agent' },
  { key: 'sources', label: '数据源' },
  { key: 'search', label: '检索' },
  { key: 'resume', label: '简历' },
  { key: 'tasks', label: '任务' },
  { key: 'export', label: '导出' },
  { key: 'privacy', label: '隐私' },
  { key: 'data', label: '数据' },
]

export function SettingsPage() {
  const {
    settings,
    updateSettings,
    resetSettings,
    testAgentConnection,
    clearJobs,
    clearTasks,
    clearMessages,
    pushToast,
    runExport,
  } = useApp()
  const [tab, setTab] = useState<SectionKey>('general')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  const [fetchingCookie, setFetchingCookie] = useState('')

  function patch<K extends keyof AppSettings>(key: K, value: Partial<AppSettings[K]>) {
    updateSettings({ [key]: { ...settings[key], ...value } } as Partial<AppSettings>)
  }

  async function fetchCookie(key: SourceKey) {
    const src = settings.sources[key]
    const desktop = isDesktopApp()
    if (!desktop) { pushToast('error', '仅桌面端支持此功能'); return }
    setFetchingCookie(key)
    try {
      const win = window as any
      if (win.jobHelperDesktop?.getCookies) {
        const cookie = await win.jobHelperDesktop.getCookies(src.baseUrl, src.label)
        if (cookie) {
          patchSource(key, { cookie })
          pushToast('success', `已获取 ${src.label} Cookie`)
        } else {
          pushToast('error', '未获取到 Cookie，请尝试重新登录')
        }
      } else {
        pushToast('error', '桌面端功能未就绪')
      }
    } catch {
      pushToast('error', '获取失败')
    } finally {
      setFetchingCookie('')
    }
  }

  function patchSource(key: SourceKey, value: Partial<AppSettings['sources'][SourceKey]>) {
    updateSettings({
      sources: {
        ...settings.sources,
        [key]: { ...settings.sources[key], ...value },
      },
    })
  }

  async function onTest() {
    setTesting(true)
    setTestResult('')
    try {
      const msg = await testAgentConnection()
      setTestResult(msg)
      pushToast('success', msg)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTestResult(msg)
      pushToast('error', msg)
    } finally {
      setTesting(false)
    }
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${settings.export.filenamePrefix || 'job-helper'}-settings.json`
    a.click()
    URL.revokeObjectURL(url)
    pushToast('success', '设置已导出')
  }

  function importSettings() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        updateSettings(JSON.parse(await file.text()) as Partial<AppSettings>)
        pushToast('success', '设置已导入')
      } catch {
        pushToast('error', '设置文件无效')
      }
    }
    input.click()
  }

  function hardResetAll() {
    if (!window.confirm('将清空设置与本地缓存。继续？')) return
    localStorage.clear()
    resetSettings()
    pushToast('info', '已重置，即将刷新')
    window.setTimeout(() => window.location.reload(), 500)
  }

  return (
    <div className="grid h-full grid-cols-[200px_minmax(0,1fr)] gap-4 bg-white px-6 py-5">
      <aside className="card overflow-auto p-2">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setTab(s.key)}
            className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-[13px] font-medium ${
              tab === s.key
                ? 'bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </aside>

      <div className="min-h-0 overflow-y-auto">
        <div className="card max-w-3xl p-5">
          {tab === 'general' && (
            <Block title="通用">
              <F label="应用名称">
                <input className="field" value={settings.general.appName} onChange={(e) => patch('general', { appName: e.target.value })} />
              </F>
              <F label="启动页">
                <select className="field" value={settings.general.startPage} onChange={(e) => patch('general', { startPage: e.target.value as AppSettings['general']['startPage'] })}>
                  {sections.filter((s) => s.key !== 'data').map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </F>
              <T label="自动保存" checked={settings.general.autoSave} onChange={(v) => patch('general', { autoSave: v })} />
              <T label="危险操作确认" checked={settings.general.confirmBeforeClear} onChange={(v) => patch('general', { confirmBeforeClear: v })} />
            </Block>
          )}

          {tab === 'appearance' && (
            <Block title="外观">
              <F label="主题">
                <select className="field" value={settings.appearance.theme} onChange={(e) => patch('appearance', { theme: e.target.value as AppSettings['appearance']['theme'] })}>
                  <option value="light">浅色（推荐）</option>
                  <option value="dark">深色</option>
                  <option value="system">跟随系统</option>
                </select>
              </F>
              <F label="强调色">
                <div className="flex gap-2">
                  <input type="color" value={settings.appearance.accent} onChange={(e) => patch('appearance', { accent: e.target.value })} className="h-10 w-12 rounded-lg border border-gray-200" />
                  <input className="field" value={settings.appearance.accent} onChange={(e) => patch('appearance', { accent: e.target.value })} />
                </div>
              </F>
            </Block>
          )}

          {tab === 'agent' && (
            <AgentSection settings={settings} patch={patch} testing={testing} testResult={testResult} onTest={() => void onTest()} />
          )}

          {tab === 'sources' && (
            <Block title="数据源">
              {(['boss', 'zhilian', 'liepin'] as SourceKey[]).map((key) => {
                const src = settings.sources[key]
                return (
                  <div key={key} className="rounded-xl border border-gray-100 p-3">
                    <div className="mb-2 flex items-center justify-between text-[13px] font-semibold">
                      {src.label}
                      <input type="checkbox" checked={src.enabled} onChange={(e) => patchSource(key, { enabled: e.target.checked })} className="accent-indigo-600" />
                    </div>
                    <F label="Base URL"><input className="field" value={src.baseUrl} onChange={(e) => patchSource(key, { baseUrl: e.target.value })} /></F>
                    <F label="Cookie">
                      <div className="flex gap-2">
                        <input className="field flex-1" value={src.cookie} onChange={(e) => patchSource(key, { cookie: e.target.value })} placeholder="配置后点「检索」自动使用" />
                        <button type="button" onClick={() => { fetchCookie(key) }} disabled={fetchingCookie !== ''} className="btn shrink-0 text-[12px] whitespace-nowrap">
                          {fetchingCookie === key ? '获取中…' : '获取 Cookie'}
                        </button>
                      </div>
                    </F>
                  </div>
                )
              })}
            </Block>
          )}

          {tab === 'search' && (
            <Block title="检索默认">
              <div className="grid grid-cols-2 gap-3">
                <F label="城市"><input className="field" value={settings.search.defaultCity} onChange={(e) => patch('search', { defaultCity: e.target.value })} /></F>
                <F label="关键词"><input className="field" value={settings.search.defaultKeyword} onChange={(e) => patch('search', { defaultKeyword: e.target.value })} /></F>
                <F label="最低 K"><input type="number" className="field" value={settings.search.minSalaryK} onChange={(e) => patch('search', { minSalaryK: Number(e.target.value) || 0 })} /></F>
                <F label="高匹配阈值"><input type="number" className="field" value={settings.search.highMatchThreshold} onChange={(e) => patch('search', { highMatchThreshold: Number(e.target.value) || 0 })} /></F>
              </div>
              <T label="仅高匹配" checked={settings.search.onlyHighMatch} onChange={(v) => patch('search', { onlyHighMatch: v })} />
            </Block>
          )}

          {tab === 'resume' && (
            <Block title="简历策略">
              <F label="目标岗位"><input className="field" value={settings.resume.targetRole} onChange={(e) => patch('resume', { targetRole: e.target.value })} /></F>
              <F label="目标城市"><input className="field" value={settings.resume.targetCities} onChange={(e) => patch('resume', { targetCities: e.target.value })} /></F>
              <F label="期望薪资"><input className="field" value={settings.resume.targetSalary} onChange={(e) => patch('resume', { targetSalary: e.target.value })} /></F>
              <F label="关键词"><input className="field" value={settings.resume.keywords} onChange={(e) => patch('resume', { keywords: e.target.value })} /></F>
            </Block>
          )}

          {tab === 'tasks' && (
            <Block title="任务引擎">
              <div className="grid grid-cols-3 gap-3">
                <F label="并发"><input type="number" className="field" value={settings.tasks.maxConcurrent} onChange={(e) => patch('tasks', { maxConcurrent: Math.max(1, Number(e.target.value) || 1) })} /></F>
                <F label="历史"><input type="number" className="field" value={settings.tasks.keepHistory} onChange={(e) => patch('tasks', { keepHistory: Number(e.target.value) || 10 })} /></F>
                <F label="重试"><input type="number" className="field" value={settings.tasks.retryTimes} onChange={(e) => patch('tasks', { retryTimes: Number(e.target.value) || 0 })} /></F>
              </div>
              <T label="自动重试" checked={settings.tasks.autoRetry} onChange={(v) => patch('tasks', { autoRetry: v })} />
              <T label="完成通知" checked={settings.tasks.notifyOnDone} onChange={(v) => patch('tasks', { notifyOnDone: v })} />
            </Block>
          )}

          {tab === 'export' && (
            <Block title="导出">
              <F label="格式">
                <select className="field" value={settings.export.defaultFormat} onChange={(e) => patch('export', { defaultFormat: e.target.value as AppSettings['export']['defaultFormat'] })}>
                  <option value="markdown">Markdown</option>
                  <option value="json">JSON</option>
                  <option value="txt">TXT</option>
                </select>
              </F>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void runExport('jobs')} className="btn">导出岗位</button>
                <button type="button" onClick={() => void runExport('resume')} className="btn">导出简历</button>
                <button type="button" onClick={() => void runExport('all')} className="btn btn-primary">全部导出</button>
              </div>
            </Block>
          )}

          {tab === 'privacy' && (
            <Block title="隐私">
              <T label="保存 API Key" checked={settings.privacy.storeApiKey} onChange={(v) => patch('privacy', { storeApiKey: v })} />
              <T label="保存对话" checked={settings.privacy.storeChatHistory} onChange={(v) => patch('privacy', { storeChatHistory: v })} />
              <T label="保存岗位缓存" checked={settings.privacy.storeJobCache} onChange={(v) => patch('privacy', { storeJobCache: v })} />
            </Block>
          )}

          {tab === 'data' && (
            <Block title="数据管理">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportSettings} className="btn">导出设置</button>
                <button type="button" onClick={importSettings} className="btn">导入设置</button>
                <button type="button" onClick={() => { updateSettings(defaultSettings); pushToast('success', '已恢复默认') }} className="btn">恢复默认</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={clearMessages} className="btn text-red-600">清空对话</button>
                <button type="button" onClick={clearJobs} className="btn text-red-600">清空岗位</button>
                <button type="button" onClick={clearTasks} className="btn text-red-600">清空任务</button>
                <button type="button" onClick={hardResetAll} className="btn btn-primary bg-red-600">重置全部</button>
              </div>
            </Block>
          )}
        </div>
      </div>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 text-[16px] font-semibold text-gray-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

function T({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 text-[13px]">
      <span className="font-medium text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-indigo-600" />
    </label>
  )
}

function AgentSection({
  settings,
  patch,
  testing,
  testResult,
  onTest,
}: {
  settings: AppSettings
  patch: <K extends keyof AppSettings>(key: K, value: Partial<AppSettings[K]>) => void
  testing: boolean
  testResult: string
  onTest: () => void
}) {
  const [subTab, setSubTab] = useState<'general' | 'skills' | 'prompts'>('general')
  const subTabs: { key: typeof subTab; label: string }[] = [
    { key: 'general', label: '通用' },
    { key: 'skills', label: '技能 & 工具' },
    { key: 'prompts', label: '提示词' },
  ]

  const prompts = settings.agent.prompts || defaultSettings.agent.prompts
  const mcps = settings.agent.mcpServers || []
  const agentSkills = settings.agent.agentSkills || defaultSettings.agent.agentSkills

  function setPrompt(key: keyof typeof prompts, v: string) {
    patch('agent', { prompts: { ...prompts, [key]: v } } as any)
  }
  function updateMcp(id: string, v: Partial<McpServer>) {
    patch('agent', {
      mcpServers: mcps.map((s) => (s.id === id ? { ...s, ...v } : s)),
    } as any)
  }
  function addMcp() {
    const s: McpServer = { id: uid('mcp'), name: '新服务', enabled: false, command: '', args: '', env: '' }
    patch('agent', { mcpServers: [...mcps, s] } as any)
  }
  function removeMcp(id: string) {
    patch('agent', { mcpServers: mcps.filter((s) => s.id !== id) } as any)
  }

  function addSkill() {
    const s: AgentSkill = { id: uid('sk'), name: '新技能', description: '', enabled: true, prompt: '' }
    patch('agent', { agentSkills: [...agentSkills, s] } as any)
  }
  function removeSkill(id: string) {
    patch('agent', { agentSkills: agentSkills.filter((s) => s.id !== id) } as any)
  }
  function updateSkill(id: string, v: Partial<AgentSkill>) {
    patch('agent', { agentSkills: agentSkills.map((s) => (s.id === id ? { ...s, ...v } : s)) } as any)
  }

  return (
    <div>
      <div className="mb-4 flex gap-1.5">
        {subTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={`rounded-xl px-3 py-2 text-[13px] font-medium ${subTab === t.key ? 'bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'general' && (
        <div className="space-y-3">
          <T label="启用" checked={settings.agent.enabled} onChange={(v) => patch('agent', { enabled: v })} />
          <F label="Provider">
            <select className="field" value={settings.agent.provider} onChange={(e) => patch('agent', { provider: e.target.value as any })}>
              <option value="mock">Mock</option>
              <option value="openai-compatible">OpenAI Compatible</option>
            </select>
          </F>
          <F label="Base URL">
            <input className="field" value={settings.agent.baseUrl} onChange={(e) => patch('agent', { baseUrl: e.target.value })} />
          </F>
          <F label="API Key">
            <input type="password" className="field" value={settings.agent.apiKey} onChange={(e) => patch('agent', { apiKey: e.target.value })} />
          </F>
          <div className="grid grid-cols-2 gap-3">
            <F label="模型"><input className="field" value={settings.agent.model} onChange={(e) => patch('agent', { model: e.target.value })} /></F>
            <F label="温度"><input type="number" step="0.1" min="0" max="2" className="field" value={settings.agent.temperature} onChange={(e) => patch('agent', { temperature: Number(e.target.value) || 0 })} /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="最大 Token"><input type="number" className="field" value={settings.agent.maxTokens} onChange={(e) => patch('agent', { maxTokens: Number(e.target.value) || 0 })} /></F>
            <F label="超时 ms"><input type="number" className="field" value={settings.agent.timeoutMs} onChange={(e) => patch('agent', { timeoutMs: Number(e.target.value) || 0 })} /></F>
          </div>
          <F label="全局 System Prompt">
            <textarea rows={3} className="field" value={settings.agent.systemPrompt} onChange={(e) => patch('agent', { systemPrompt: e.target.value })} />
          </F>
          <T label="流式输出" checked={settings.agent.stream} onChange={(v) => patch('agent', { stream: v })} />
          <T label="优化时自动写入简历" checked={settings.agent.autoSuggestResume} onChange={(v) => patch('agent', { autoSuggestResume: v })} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={onTest} disabled={testing} className="btn btn-primary disabled:opacity-50">
              {testing ? '测试中…' : '测试连接'}
            </button>
            {testResult && <span className="text-[12px] text-gray-500">{testResult}</span>}
          </div>
        </div>
      )}

      {subTab === 'skills' && (
        <div className="space-y-3">
          <Block title="Agent 技能">
            <p className="mb-3 text-[12px] text-gray-400">
              自定义 Agent 能力。每个技能代表一种专长，可单独开关并配置专属提示词。
            </p>
            <div className="space-y-3">
              {agentSkills.map((s) => (
                <div key={s.id} className={`rounded-xl border p-3 ${s.enabled ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100'}`}>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <input
                        className="w-full bg-transparent text-[13px] font-semibold text-gray-800 outline-none"
                        value={s.name}
                        onChange={(e) => updateSkill(s.id, { name: e.target.value })}
                        placeholder="技能名称"
                      />
                      <input
                        className="mt-1 w-full bg-transparent text-[12px] text-gray-400 outline-none"
                        value={s.description}
                        onChange={(e) => updateSkill(s.id, { description: e.target.value })}
                        placeholder="描述这个技能做什么"
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => updateSkill(s.id, { enabled: e.target.checked })}
                        className="accent-indigo-600"
                      />
                      <button type="button" onClick={() => removeSkill(s.id)} className="text-[11px] text-red-500">删除</button>
                    </div>
                  </div>
                  <textarea
                    className="field mt-2 text-[12px]"
                    rows={2}
                    value={s.prompt}
                    onChange={(e) => updateSkill(s.id, { prompt: e.target.value })}
                    placeholder="自定义提示词（可选，留空用默认）"
                  />
                </div>
              ))}
              <button type="button" onClick={addSkill} className="btn w-full text-[12px]">+ 添加技能</button>
            </div>
          </Block>

          <Block title="MCP 服务器">
            <p className="mb-3 text-[12px] text-gray-400">
              配置 MCP（Model Context Protocol）服务器扩展 Agent 能力，如文件系统访问、数据库查询等。
              <br />启动命令示例：<code className="rounded bg-gray-100 px-1 text-[11px]">npx -y @anthropic/mcp-server-filesystem /path</code>
            </p>
            <div className="space-y-3">
              {mcps.map((s) => (
                <div key={s.id} className="rounded-xl border border-gray-100 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <input
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-gray-800 outline-none"
                      value={s.name}
                      onChange={(e) => updateMcp(s.id, { name: e.target.value })}
                      placeholder="服务名称"
                    />
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={s.enabled} onChange={(e) => updateMcp(s.id, { enabled: e.target.checked })} className="accent-indigo-600" />
                      <button type="button" onClick={() => removeMcp(s.id)} className="text-[11px] text-red-500">删除</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input className="field text-[12px]" value={s.command} onChange={(e) => updateMcp(s.id, { command: e.target.value })} placeholder="命令 (如 npx)" />
                    <input className="field text-[12px]" value={s.args} onChange={(e) => updateMcp(s.id, { args: e.target.value })} placeholder="参数" />
                  </div>
                  <input className="mt-2 field text-[12px]" value={s.env} onChange={(e) => updateMcp(s.id, { env: e.target.value })} placeholder="环境变量 (KEY=VALUE;...)" />
                </div>
              ))}
              <button type="button" onClick={addMcp} className="btn w-full text-[12px]">+ 添加 MCP 服务器</button>
            </div>
          </Block>
        </div>
      )}

      {subTab === 'prompts' && (
        <div className="space-y-3">
          <p className="text-[12px] text-gray-400">为不同功能定制提示词。留空则使用内置默认。</p>
          <F label="全局 System Prompt">
            <textarea rows={2} className="field text-[12px]" value={prompts.system || settings.agent.systemPrompt} onChange={(e) => setPrompt('system', e.target.value)} placeholder="全局系统提示词" />
          </F>
          <F label="岗位检索">
            <textarea rows={2} className="field text-[12px]" value={prompts.search} onChange={(e) => setPrompt('search', e.target.value)} />
          </F>
          <F label="简历优化">
            <textarea rows={2} className="field text-[12px]" value={prompts.optimize} onChange={(e) => setPrompt('optimize', e.target.value)} />
          </F>
          <F label="JD 分析">
            <textarea rows={2} className="field text-[12px]" value={prompts.analyzeJd} onChange={(e) => setPrompt('analyzeJd', e.target.value)} />
          </F>
          <F label="模拟面试">
            <textarea rows={2} className="field text-[12px]" value={prompts.interview} onChange={(e) => setPrompt('interview', e.target.value)} />
          </F>
          <F label="话术生成">
            <textarea rows={2} className="field text-[12px]" value={prompts.pitch} onChange={(e) => setPrompt('pitch', e.target.value)} />
          </F>
        </div>
      )}
    </div>
  )
}
