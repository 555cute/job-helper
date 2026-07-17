import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  STORAGE_KEYS,
  defaultMessages,
  defaultResume,
  defaultSettings,
  defaultSuggestions,
  emptyTasks,
  seedJobs,
} from '../data/defaults'
import { applySuggestionToResume, toChat } from '../lib/agent'
import { api } from '../lib/api'
import { exportApplyPackage, exportJobs, exportResume } from '../lib/export'
import { analyzeJdAgainstResume, buildPitch, jobFromAnalysis } from '../lib/jd'
import { recomputeMatches } from '../lib/match'
import { enabledSources, type SearchQuery } from '../lib/searchEngine'
import { loadArray, loadJson, saveJson } from '../lib/storage'
import { nowLabel, nowTime, uid } from '../lib/id'
import type {
  AppSettings,
  ApplyStatus,
  ChatMessage,
  JdAnalysis,
  JobPost,
  NavKey,
  ResumeSection,
  ResumeSuggestion,
  SourceKey,
  TaskItem,
} from '../types'

type Toast = { id: string; type: 'info' | 'success' | 'error'; text: string }

type AppContextValue = {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings> | ((s: AppSettings) => AppSettings)) => void
  resetSettings: () => void
  nav: NavKey
  setNav: (n: NavKey) => void
  seedPrompt: string | null
  setSeedPrompt: (p: string | null) => void
  resume: ResumeSection[]
  setResume: (r: ResumeSection[] | ((prev: ResumeSection[]) => ResumeSection[])) => void
  suggestions: ResumeSuggestion[]
  applySuggestion: (id: string) => void
  jobs: JobPost[]
  setJobs: (j: JobPost[] | ((prev: JobPost[]) => JobPost[])) => void
  tasks: TaskItem[]
  messages: ChatMessage[]
  clearMessages: () => void
  toast: Toast | null
  pushToast: (type: Toast['type'], text: string) => void
  stats: {
    resumeScore: number
    highMatchCount: number
    runningTasks: number
    enabledSourceCount: number
    starredCount: number
    appliedCount: number
  }
  backendOnline: boolean
  runSearch: (q?: Partial<SearchQuery>) => Promise<JobPost[]>
  addJobsToPipeline: (jobs: JobPost[]) => void
  removeJob: (id: string) => void
  runOptimizeResume: (target?: string) => Promise<void>
  runMatch: (count?: number) => Promise<void>
  runExport: (kind?: 'jobs' | 'resume' | 'all') => Promise<void>
  sendAgent: (text: string) => Promise<void>
  cancelTask: (id: string) => void
  clearTasks: () => void
  clearJobs: () => void
  recomputeJobMatches: () => void
  importResumeText: (text: string) => void
  testAgentConnection: () => Promise<string>
  updateJob: (id: string, patch: Partial<JobPost>) => void
  toggleStarJob: (id: string) => void
  setJobStatus: (id: string, status: ApplyStatus) => void
  setJobNote: (id: string, note: string) => void
  generatePitchForJob: (id: string) => void
  exportPackageForJob: (id: string) => void
  analyzeJd: (jdText: string) => Promise<JdAnalysis>
  applyJdToResume: (analysis: JdAnalysis) => void
  saveJdAsJob: (analysis: JdAnalysis, rawJd: string) => string
  lastJdAnalysis: JdAnalysis | null
  setLastJdAnalysis: (a: JdAnalysis | null) => void
  hasResume: boolean
  setHasResume: (v: boolean) => void
  parseResume: (rawText: string) => Promise<void>
  importJobsFromJson: (arr: unknown[]) => void
}

const AppContext = createContext<AppContextValue | null>(null)

function deepMergeSettings(base: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return {
    ...base,
    ...patch,
    general: { ...base.general, ...patch.general },
    appearance: { ...base.appearance, ...patch.appearance },
    agent: { ...base.agent, ...patch.agent, skills: { ...base.agent.skills, ...patch.agent?.skills }, agentSkills: patch.agent?.agentSkills ?? base.agent.agentSkills, prompts: { ...base.agent.prompts, ...patch.agent?.prompts }, mcpServers: patch.agent?.mcpServers ?? base.agent.mcpServers },
    sources: {
      ...base.sources,
      ...patch.sources,
      boss: { ...base.sources.boss, ...patch.sources?.boss },
      zhilian: { ...base.sources.zhilian, ...patch.sources?.zhilian },
      liepin: { ...base.sources.liepin, ...patch.sources?.liepin },
    },
    search: { ...base.search, ...patch.search },
    resume: { ...base.resume, ...patch.resume },
    tasks: { ...base.tasks, ...patch.tasks },
    export: { ...base.export, ...patch.export },
    privacy: { ...base.privacy, ...patch.privacy },
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(() =>
    loadJson(STORAGE_KEYS.settings, defaultSettings),
  )
  const [nav, setNav] = useState<NavKey>(() => {
    const hash = typeof location !== 'undefined' ? location.hash.replace('#', '') : ''
    const validKeys = ['workbench', 'agent', 'resume', 'search', 'pipeline', 'interview', 'settings']
    return validKeys.includes(hash) ? hash as NavKey : settings.general.startPage
  })
  const [seedPrompt, setSeedPrompt] = useState<string | null>(null)
  const [resume, setResumeState] = useState<ResumeSection[]>(() =>
    loadArray(STORAGE_KEYS.resume, defaultResume),
  )
  const [suggestions, setSuggestions] = useState<ResumeSuggestion[]>(() =>
    loadArray(STORAGE_KEYS.suggestions, defaultSuggestions),
  )
  const [jobs, setJobsState] = useState<JobPost[]>(() =>
    settings.privacy.storeJobCache ? loadArray(STORAGE_KEYS.jobs, seedJobs) : seedJobs,
  )
  const [tasks, setTasks] = useState<TaskItem[]>(() => loadArray(STORAGE_KEYS.tasks, emptyTasks))
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    settings.privacy.storeChatHistory
      ? loadArray(STORAGE_KEYS.messages, defaultMessages(settings.general.appName))
      : defaultMessages(settings.general.appName),
  )
  // 是否已经上传过简历（有非空内容且不是默认数据）
  const hasResumeFromStorage =
    resume.length > 0 &&
    resume.some((s) => s.content.trim().length > 20) &&
    !resume.every(
      (s, i) =>
        defaultResume[i] && s.content.trim() === defaultResume[i].content.trim(),
    )
  const [hasResume, setHasResume] = useState(hasResumeFromStorage || !!localStorage.getItem('job-helper:onboarded:v2'))
  const [toast, setToast] = useState<Toast | null>(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [lastJdAnalysis, setLastJdAnalysis] = useState<JdAnalysis | null>(null)
  const runningRef = useRef(0)
  const cancelledRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    const ping = async () => {
      try {
        await api.health()
        if (alive) setBackendOnline(true)
      } catch {
        if (alive) setBackendOnline(false)
      }
    }
    void ping()
    const timer = window.setInterval(ping, 5000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const pushToast = useCallback((type: Toast['type'], text: string) => {
    const id = uid('toast')
    setToast({ id, type, text })
    window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3200)
  }, [])

  const updateSettings = useCallback(
    (patch: Partial<AppSettings> | ((s: AppSettings) => AppSettings)) => {
      setSettingsState((prev) => {
        const next = typeof patch === 'function' ? patch(prev) : deepMergeSettings(prev, patch)
        return next
      })
    },
    [],
  )

  const resetSettings = useCallback(() => {
    setSettingsState(defaultSettings)
    pushToast('success', '设置已恢复默认')
  }, [pushToast])

  const setResume = useCallback(
    (r: ResumeSection[] | ((prev: ResumeSection[]) => ResumeSection[])) => {
      setResumeState(r)
    },
    [],
  )

  const setJobs = useCallback((j: JobPost[] | ((prev: JobPost[]) => JobPost[])) => {
    setJobsState(j)
  }, [])

  // persist
  useEffect(() => {
    if (!settings.general.autoSave) return
    const toSave = { ...settings }
    if (!settings.privacy.storeApiKey) toSave.agent = { ...toSave.agent, apiKey: '' }
    saveJson(STORAGE_KEYS.settings, toSave)
  }, [settings])

  useEffect(() => {
    if (settings.general.autoSave) saveJson(STORAGE_KEYS.resume, resume)
  }, [resume, settings.general.autoSave])

  useEffect(() => {
    if (settings.general.autoSave) saveJson(STORAGE_KEYS.suggestions, suggestions)
  }, [suggestions, settings.general.autoSave])

  useEffect(() => {
    if (settings.privacy.storeJobCache && settings.general.autoSave) {
      saveJson(STORAGE_KEYS.jobs, jobs)
    }
  }, [jobs, settings.privacy.storeJobCache, settings.general.autoSave])

  useEffect(() => {
    if (settings.general.autoSave) {
      const kept = tasks.slice(0, settings.tasks.keepHistory)
      saveJson(STORAGE_KEYS.tasks, kept)
    }
  }, [tasks, settings.general.autoSave, settings.tasks.keepHistory])

  useEffect(() => {
    if (settings.privacy.storeChatHistory && settings.general.autoSave) {
      saveJson(STORAGE_KEYS.messages, messages.slice(-200))
    }
  }, [messages, settings.privacy.storeChatHistory, settings.general.autoSave])

  // theme
  useEffect(() => {
    const root = document.documentElement
    const dark =
      settings.appearance.theme === 'dark' ||
      (settings.appearance.theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('dark', dark)
    root.style.setProperty('--color-primary', settings.appearance.accent)
    root.dataset.density = settings.appearance.density
  }, [settings.appearance])

  const upsertTask = useCallback((task: TaskItem) => {
    setTasks((list) => {
      const idx = list.findIndex((t) => t.id === task.id)
      if (idx === -1) return [task, ...list].slice(0, 100)
      const next = [...list]
      next[idx] = task
      return next
    })
  }, [])

  const createTask = useCallback(
    (partial: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'status'> & {
      status?: TaskItem['status']
      progress?: number
    }) => {
      const task: TaskItem = {
        id: uid('task'),
        status: partial.status || 'queued',
        progress: partial.progress ?? 0,
        createdAt: nowLabel(),
        updatedAt: nowTime(),
        ...partial,
      }
      upsertTask(task)
      return task
    },
    [upsertTask],
  )

  const waitSlot = useCallback(async () => {
    while (runningRef.current >= settings.tasks.maxConcurrent) {
      await new Promise((r) => setTimeout(r, 120))
    }
  }, [settings.tasks.maxConcurrent])

  const runWithTask = useCallback(
    async (
      name: string,
      type: TaskItem['type'],
      runner: (task: TaskItem, tick: (p: number, summary?: string) => void) => Promise<string>,
      payload?: Record<string, unknown>,
    ) => {
      let task = createTask({ name, type, payload, status: 'queued', summary: '排队中' })
      await waitSlot()
      if (cancelledRef.current.has(task.id)) {
        upsertTask({ ...task, status: 'cancelled', summary: '已取消', updatedAt: nowTime() })
        return
      }
      runningRef.current += 1
      task = { ...task, status: 'running', progress: 5, summary: '执行中', updatedAt: nowTime() }
      upsertTask(task)

      const tick = (p: number, summary?: string) => {
        if (cancelledRef.current.has(task.id)) return
        task = {
          ...task,
          progress: Math.min(99, p),
          summary: summary || task.summary,
          updatedAt: nowTime(),
        }
        upsertTask(task)
      }

      try {
        const result = await runner(task, tick)
        if (cancelledRef.current.has(task.id)) {
          upsertTask({ ...task, status: 'cancelled', summary: '已取消', updatedAt: nowTime() })
          return
        }
        upsertTask({
          ...task,
          status: 'done',
          progress: 100,
          summary: result,
          result,
          updatedAt: nowTime(),
        })
        if (settings.tasks.notifyOnDone) pushToast('success', `${name} 完成`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (settings.tasks.autoRetry && !cancelledRef.current.has(task.id)) {
          for (let i = 0; i < settings.tasks.retryTimes; i++) {
            try {
              tick(20, `重试 ${i + 1}…`)
              const result = await runner(task, tick)
              upsertTask({
                ...task,
                status: 'done',
                progress: 100,
                summary: result,
                result,
                updatedAt: nowTime(),
              })
              if (settings.tasks.notifyOnDone) pushToast('success', `${name} 完成`)
              return
            } catch {
              /* continue */
            }
          }
        }
        upsertTask({
          ...task,
          status: 'failed',
          progress: 100,
          summary: msg,
          error: msg,
          updatedAt: nowTime(),
        })
        pushToast('error', `${name} 失败：${msg}`)
      } finally {
        runningRef.current = Math.max(0, runningRef.current - 1)
      }
    },
    [createTask, waitSlot, upsertTask, settings.tasks, pushToast],
  )

  const recomputeJobMatches = useCallback(() => {
    setJobsState((prev) => recomputeMatches(prev, resume, settings.resume.keywords))
    pushToast('info', '已按当前简历重算匹配分')
  }, [resume, settings.resume.keywords, pushToast])

  const addJobsToPipeline = useCallback((newJobs: JobPost[]) => {
    setJobsState((prev) => {
      const map = new Map(prev.map((j) => [`${j.source}-${j.title}-${j.company}`, j]))
      for (const j of newJobs) {
        const key = `${j.source}-${j.title}-${j.company}`
        map.set(key, { ...j, applyStatus: 'new' as ApplyStatus, id: j.id || uid('job') })
      }
      return [...map.values()].sort((a, b) => b.match - a.match)
    })
    pushToast('success', `已添加 ${newJobs.length} 个岗位到待投递`)
  }, [pushToast])

  const removeJob = useCallback((id: string) => {
    setJobsState((prev) => prev.filter((j) => j.id !== id))
  }, [])

  const mergeServerTask = useCallback((serverTask?: TaskItem | null) => {
    if (!serverTask?.id) return
    setTasks((list) => {
      const idx = list.findIndex((t) => t.id === serverTask.id)
      if (idx === -1) return [serverTask, ...list].slice(0, 100)
      const next = [...list]
      next[idx] = { ...next[idx], ...serverTask }
      return next
    })
  }, [])

  const runSearch = useCallback(
    async (q?: Partial<SearchQuery>) => {
      const sources =
        q?.sources ||
        enabledSources(settings) ||
        (['boss', 'zhilian'] as SourceKey[])
      const query: SearchQuery = {
        keyword: q?.keyword ?? settings.search.defaultKeyword,
        city: q?.city ?? settings.search.defaultCity,
        minSalaryK: q?.minSalaryK ?? settings.search.minSalaryK,
        sources,
      }
      let result: JobPost[] = []
      await runWithTask(
        `检索 ${query.city} · ${query.keyword}`,
        'search',
        async (_t, tick) => {
          tick(30, '请求后端…')
          const data = await api.search({ query, resume, settings })
          mergeServerTask(data.task)
          result = data.jobs || []
          tick(80, `命中 ${result.length} 条`)
          return `命中 ${result.length} 条（${data.mode || ''}）`
        },
        { ...query },
      )
      return result
    },
    [settings, resume, runWithTask, mergeServerTask],
  )

  const runOptimizeResume = useCallback(
    async (target?: string) => {
      await runWithTask(
        `简历优化 · ${target || settings.resume.targetRole}`,
        'resume',
        async (_t, tick) => {
          tick(20, '请求后端优化…')
          const data = await api.optimizeResume({ resume, settings, target })
          mergeServerTask(data.task)
          setSuggestions(data.suggestions || [])
          if (data.resume?.length) setResumeState(data.resume)
          tick(90, '写入建议…')
          return `生成 ${data.suggestions?.length || 0} 条建议（${data.source}）`
        },
      )
    },
    [settings, resume, runWithTask, mergeServerTask],
  )

  const runMatch = useCallback(
    async (count = 5) => {
      await runWithTask(
        `匹配分析 Top ${count}`,
        'match',
        async (_t, tick) => {
          tick(30, '请求后端匹配…')
          const data = await api.match({
            jobs,
            resume,
            keywords: settings.resume.keywords,
            count,
          })
          mergeServerTask(data.task)
          setJobsState(data.jobs || [])
          const top = data.top || []
          return top.map((j: JobPost) => `${j.match} ${j.title}`).join('；') || '无岗位'
        },
      )
    },
    [jobs, resume, settings.resume.keywords, runWithTask, mergeServerTask],
  )

  const runExport = useCallback(
    async (kind: 'jobs' | 'resume' | 'all' = 'all') => {
      await runWithTask(`导出 ${kind}`, 'export', async () => {
        const names: string[] = []
        if (kind === 'jobs' || kind === 'all') names.push(exportJobs(jobs, resume, settings))
        if (kind === 'resume' || kind === 'all') names.push(exportResume(resume, settings))
        return `已下载：${names.join('，')}`
      })
    },
    [jobs, resume, settings, runWithTask],
  )

  const sendAgent = useCallback(
    async (text: string) => {
      const content = text.trim()
      if (!content) return
      if (!settings.agent.enabled) {
        pushToast('error', 'Agent 已关闭，请到设置开启')
        return
      }

      const userMsg = toChat('user', content)
      setMessages((m) => [...m, userMsg])

      await runWithTask(
        'Agent 对话',
        'agent',
        async (_t, tick) => {
          tick(20, '请求后端 Agent…')
          const data = await api.agentChat({
            message: content,
            resume,
            jobs,
            settings,
            history: messages.slice(-30),
          })
          mergeServerTask(data.task)

          if (data.jobs?.length) {
            setJobsState((prev) => {
              const map = new Map(prev.map((j) => [`${j.source}-${j.title}-${j.company}`, j]))
              for (const j of data.jobs!) map.set(`${j.source}-${j.title}-${j.company}`, j)
              return [...map.values()].sort((a, b) => b.match - a.match)
            })
          }
          if (data.suggestions?.length) setSuggestions(data.suggestions)
          if (data.resume?.length) setResumeState(data.resume)
          const maybeAnalysis = (data as { analysis?: JdAnalysis }).analysis
          if (maybeAnalysis) setLastJdAnalysis(maybeAnalysis)
          if (data.action?.type === 'export') {
            tick(70, '导出…')
            await runExport('all')
          }

          setMessages((m) => [...m, toChat('agent', data.reply)])
          tick(95, '回复完成')
          return 'Agent 回复完成'
        },
      )
    },
    [settings, jobs, resume, messages, runExport, runWithTask, mergeServerTask, pushToast],
  )

  const applySuggestion = useCallback(
    (id: string) => {
      const sg = suggestions.find((s) => s.id === id)
      if (!sg) return
      setResumeState((prev) => applySuggestionToResume(prev, sg))
      setSuggestions((list) => list.map((s) => (s.id === id ? { ...s, applied: true } : s)))
      pushToast('success', '已应用到简历')
    },
    [suggestions, pushToast],
  )

  const cancelTask = useCallback(
    (id: string) => {
      cancelledRef.current.add(id)
      setTasks((list) =>
        list.map((t) =>
          t.id === id && (t.status === 'queued' || t.status === 'running')
            ? { ...t, status: 'cancelled', summary: '已取消', updatedAt: nowTime() }
            : t,
        ),
      )
      void api.cancelTask(id).catch(() => undefined)
    },
    [],
  )

  const clearTasks = useCallback(() => {
    if (settings.general.confirmBeforeClear && !window.confirm('清空全部任务记录？')) return
    setTasks([])
    void api.clearTasks().catch(() => undefined)
    pushToast('info', '任务已清空')
  }, [settings.general.confirmBeforeClear, pushToast])

  const clearJobs = useCallback(() => {
    if (settings.general.confirmBeforeClear && !window.confirm('清空岗位缓存？')) return
    setJobsState([])
    pushToast('info', '岗位已清空')
  }, [settings.general.confirmBeforeClear, pushToast])

  const clearMessages = useCallback(() => {
    if (settings.general.confirmBeforeClear && !window.confirm('清空对话记录？')) return
    setMessages(defaultMessages(settings.general.appName))
  }, [settings.general.confirmBeforeClear, settings.general.appName])

  const importResumeText = useCallback(
    (text: string) => {
      const parts = text
        .split(/\n(?=#{1,3}\s|【|■)/)
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length <= 1) {
        setResumeState([{ id: uid('sec'), title: '导入正文', content: text.trim() }])
      } else {
        setResumeState(
          parts.map((p, i) => {
            const lines = p.split('\n')
            const title = lines[0].replace(/^#+\s*/, '').replace(/[【】]/g, '') || `段落 ${i + 1}`
            return { id: uid('sec'), title, content: lines.slice(1).join('\n').trim() || p }
          }),
        )
      }
      pushToast('success', '简历已导入')
    },
    [pushToast],
  )

  const testAgentConnection = useCallback(async () => {
    const data = await api.testAgent(settings.agent)
    if (!data.ok) throw new Error(data.error || '连接失败')
    return data.message || '连接成功'
  }, [settings.agent])

  const parseResume = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text) throw new Error('请提供简历文本')

      let sections: ResumeSection[] = []
      let config = null

      try {
        const data = await api.parseResume({ text, settings })
        sections = (data.sections || []) as ResumeSection[]
        config = data.config
        mergeServerTask(data.task)
      } catch {
        // 后端不可用 → 本地简单分块
        const blocks = text
          .split(/\n{2,}/)
          .map((b) => b.trim())
          .filter(Boolean)
        if (blocks.length === 1) {
          sections = [{ id: uid('sec'), title: '简历正文', content: blocks[0] }]
        } else {
          sections = blocks.map((b, i) => ({
            id: uid('sec'),
            title: i === 0 ? '个人优势' : `段落 ${i + 1}`,
            content: b,
          }))
        }
      }

      if (sections.length) {
        setResumeState(sections)
      }

      if (config) {
        updateSettings({
          resume: {
            ...settings.resume,
            targetRole: config.targetRole || settings.resume.targetRole,
            targetCities: config.targetCities || settings.resume.targetCities,
            targetSalary: config.targetSalary || settings.resume.targetSalary,
            keywords: config.keywords || settings.resume.keywords,
          },
        })
      }

      setHasResume(true)
      localStorage.setItem('job-helper:onboarded:v2', '1')
      pushToast('success', `已解析为 ${sections.length} 段，可到「简历」页编辑`)
    },
    [settings, pushToast, mergeServerTask],
  )

  const updateJob = useCallback((id: string, patch: Partial<JobPost>) => {
    setJobsState((list) => list.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }, [])

  const toggleStarJob = useCallback(
    (id: string) => {
      setJobsState((list) =>
        list.map((j) =>
          j.id === id
            ? {
                ...j,
                starred: !j.starred,
                applyStatus: !j.starred && (!j.applyStatus || j.applyStatus === 'new') ? 'saved' : j.applyStatus,
              }
            : j,
        ),
      )
    },
    [],
  )

  const setJobStatus = useCallback((id: string, status: ApplyStatus) => {
    setJobsState((list) => list.map((j) => (j.id === id ? { ...j, applyStatus: status } : j)))
  }, [])

  const setJobNote = useCallback((id: string, note: string) => {
    setJobsState((list) => list.map((j) => (j.id === id ? { ...j, note } : j)))
  }, [])

  const generatePitchForJob = useCallback(
    (id: string) => {
      setJobsState((list) =>
        list.map((j) => {
          if (j.id !== id) return j
          const pitch = buildPitch(j, j.match, settings)
          return { ...j, pitch }
        }),
      )
      pushToast('success', '话术已生成，可在详情复制')
    },
    [settings, pushToast],
  )

  const exportPackageForJob = useCallback(
    (id: string) => {
      const job = jobs.find((j) => j.id === id)
      if (!job) return
      const name = exportApplyPackage(job, resume, settings)
      pushToast('success', `已导出材料包：${name}`)
    },
    [jobs, resume, settings, pushToast],
  )

  const analyzeJd = useCallback(
    async (jdText: string) => {
      const text = jdText.trim()
      if (!text) throw new Error('请粘贴 JD 文本')

      // 优先走后端；失败则本地分析
      try {
        const data = await api.analyzeJd({ jd: text, resume, settings })
        if (data?.analysis) {
          setLastJdAnalysis(data.analysis)
          mergeServerTask(data.task)
          return data.analysis as JdAnalysis
        }
      } catch {
        /* local fallback */
      }

      const analysis = analyzeJdAgainstResume(text, resume, settings)
      setLastJdAnalysis(analysis)
      return analysis
    },
    [resume, settings, mergeServerTask],
  )

  const applyJdToResume = useCallback(
    (analysis: JdAnalysis) => {
      setSuggestions(analysis.suggestions)
      // 自动应用前 2 条，其余留给用户确认
      setResumeState((prev) => {
        let next = prev
        for (const sg of analysis.suggestions.slice(0, 2)) {
          next = applySuggestionToResume(next, sg)
        }
        // 技能段合并缺失关键词
        if (analysis.missingKeywords.length) {
          next = next.map((s) => {
            if (s.id !== 'skills') return s
            const merged = [
              ...new Set(
                [...s.content.split(/[,，、\s]+/), ...analysis.missingKeywords].filter(Boolean),
              ),
            ]
            return { ...s, content: merged.join(', ') }
          })
        }
        return next
      })
      // 标记建议已部分应用
      setSuggestions((list) =>
        list.map((s, i) => (i < 2 ? { ...s, applied: true } : s)),
      )
      pushToast('success', '已按 JD 改写简历（前 2 条建议已应用）')
    },
    [pushToast],
  )

  const saveJdAsJob = useCallback(
    (analysis: JdAnalysis, rawJd: string) => {
      const job = jobFromAnalysis(analysis, rawJd)
      setJobsState((prev) => [job, ...prev])
      pushToast('success', '已保存为收藏岗位')
      return job.id
    },
    [pushToast],
  )

  const importJobsFromJson = useCallback((arr: unknown[]) => {
    const list = (arr || []).map((item: any) => ({
      id: uid('job'),
      title: String(item.title || item.position || '未命名岗位'),
      company: String(item.company || item.employer || '未知公司'),
      city: String(item.city || '待定'),
      salary: String(item.salary || '面议'),
      source: (['boss', 'zhilian', 'liepin'].includes(item.source) ? item.source : 'boss') as SourceKey,
      match: Number(item.match) || 0,
      tags: Array.isArray(item.tags) ? item.tags : String(item.tags || '').split(/[,，、\s]+/).filter(Boolean),
      experience: String(item.experience || ''),
      education: String(item.education || ''),
      updatedAt: '导入',
      link: String(item.link || ''),
      reason: String(item.reason || ''),
      jd: String(item.jd || item.description || ''),
      applyStatus: (['new', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived'].includes(item.applyStatus) ? item.applyStatus : 'new') as ApplyStatus,
      note: String(item.note || ''),
      starred: !!item.starred,
    } as JobPost))

    setJobsState((prev) => {
      const map = new Map(prev.map((j) => [`${j.source}-${j.title}-${j.company}`, j]))
      for (const j of list) map.set(`${j.source}-${j.title}-${j.company}`, j)
      return [...map.values()]
    })
    pushToast('success', `已导入 ${list.length} 条岗位`)
  }, [pushToast])

  const stats = useMemo(() => {
    const text = resume.map((r) => r.content).join('')
    const resumeScore = Math.min(
      100,
      40 +
        resume.length * 8 +
        Math.min(30, Math.floor(text.length / 40)) +
        (settings.resume.keywords ? 10 : 0),
    )
    return {
      resumeScore,
      highMatchCount: jobs.filter((j) => j.match >= settings.search.highMatchThreshold).length,
      runningTasks: tasks.filter((t) => t.status === 'running' || t.status === 'queued').length,
      enabledSourceCount: enabledSources(settings).length,
      starredCount: jobs.filter((j) => j.starred).length,
      appliedCount: jobs.filter((j) => j.applyStatus === 'applied' || j.applyStatus === 'interviewing').length,
    }
  }, [resume, jobs, tasks, settings])

  const value: AppContextValue = {
    settings,
    updateSettings,
    resetSettings,
    nav,
    setNav,
    seedPrompt,
    setSeedPrompt,
    resume,
    setResume,
    suggestions,
    applySuggestion,
    jobs,
    setJobs,
    tasks,
    messages,
    clearMessages,
    toast,
    pushToast,
    stats,
    backendOnline,
    runSearch,
    addJobsToPipeline,
    removeJob,
    runOptimizeResume,
    runMatch,
    runExport,
    sendAgent,
    cancelTask,
    clearTasks,
    clearJobs,
    recomputeJobMatches,
    importResumeText,
    testAgentConnection,
    updateJob,
    toggleStarJob,
    setJobStatus,
    setJobNote,
    generatePitchForJob,
    exportPackageForJob,
    analyzeJd,
    applyJdToResume,
    saveJdAsJob,
    lastJdAnalysis,
    setLastJdAnalysis,
    hasResume,
    setHasResume,
    parseResume,
    importJobsFromJson,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
