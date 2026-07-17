export type SourceKey = 'boss' | 'zhilian' | 'liepin'
export type SourceFilter = SourceKey | 'all'

export type ApplyStatus =
  | 'new'
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'archived'

export type JobPost = {
  id: string
  title: string
  company: string
  city: string
  salary: string
  source: SourceKey
  match: number
  tags: string[]
  experience: string
  education: string
  updatedAt: string
  link: string
  reason: string
  jd?: string
  /** 收藏 */
  starred?: boolean
  /** 投递跟进状态 */
  applyStatus?: ApplyStatus
  /** 备注 */
  note?: string
  /** 打招呼话术 */
  pitch?: string
  /** 匹配短板 */
  gaps?: string[]
  /** 建议补的关键词 */
  missingKeywords?: string[]
}

export type JdAnalysis = {
  title: string
  company: string
  city: string
  salary: string
  tags: string[]
  match: number
  reason: string
  gaps: string[]
  missingKeywords: string[]
  hits: string[]
  suggestions: ResumeSuggestion[]
  pitch: string
  reportMarkdown: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'agent' | 'system'
  content: string
  time: string
}

export type ResumeSection = {
  id: string
  title: string
  content: string
}

export type TaskType = 'resume' | 'search' | 'match' | 'export' | 'agent'
export type TaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export type TaskItem = {
  id: string
  name: string
  type: TaskType
  status: TaskStatus
  progress: number
  summary: string
  updatedAt: string
  createdAt: string
  error?: string
  result?: string
  payload?: Record<string, unknown>
}

export type ResumeSuggestion = {
  id: string
  title: string
  text: string
  sectionId?: string
  applied?: boolean
}

export type AppSettings = {
  general: {
    appName: string
    language: 'zh-CN' | 'en'
    startPage: 'workbench' | 'agent' | 'resume' | 'search' | 'pipeline' | 'settings'
    confirmBeforeClear: boolean
    autoSave: boolean
  }
  appearance: {
    theme: 'light' | 'dark' | 'system'
    density: 'comfortable' | 'compact'
    sidebarCollapsed: boolean
    accent: string
  }
  agent: {
    enabled: boolean
    provider: 'openai-compatible' | 'mock'
    baseUrl: string
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
    systemPrompt: string
    stream: boolean
    timeoutMs: number
    autoRunOnSearch: boolean
    autoSuggestResume: boolean
    skills: AgentSkills
    agentSkills: AgentSkill[]
    mcpServers: McpServer[]
    prompts: AgentPrompts
  }
  sources: {
    boss: SourceConfig
    zhilian: SourceConfig
    liepin: SourceConfig
    maxResults: number
    requestIntervalMs: number
    respectRobots: boolean
  }
  search: {
    defaultCity: string
    defaultKeyword: string
    minSalaryK: number
    onlyHighMatch: boolean
    highMatchThreshold: number
    sortBy: 'match' | 'salary' | 'updated'
    openLinksInNewTab: boolean
  }
  resume: {
    targetRole: string
    targetCities: string
    targetSalary: string
    keywords: string
    tone: 'professional' | 'concise' | 'impact'
    autoBackup: boolean
  }
  tasks: {
    maxConcurrent: number
    keepHistory: number
    autoRetry: boolean
    retryTimes: number
    notifyOnDone: boolean
  }
  export: {
    defaultFormat: 'markdown' | 'json' | 'txt'
    includeMatchReason: boolean
    includeResume: boolean
    filenamePrefix: string
  }
  privacy: {
    storeApiKey: boolean
    storeChatHistory: boolean
    storeJobCache: boolean
    analytics: boolean
  }
}

export type SourceConfig = {
  enabled: boolean
  label: string
  baseUrl: string
  cookie: string
  note: string
}

export type AgentSkills = {
  searchJobs: boolean
  optimizeResume: boolean
  analyzeJd: boolean
  checkPipeline: boolean
  generatePitch: boolean
  exportMaterials: boolean
  interview: boolean
}

export type AgentSkill = {
  id: string
  name: string
  description: string
  enabled: boolean
  prompt: string
}

export type McpServer = {
  id: string
  name: string
  enabled: boolean
  command: string
  args: string
  env: string
}

export type AgentPrompts = {
  system: string
  search: string
  optimize: string
  analyzeJd: string
  interview: string
  pitch: string
}

export type NavKey = 'workbench' | 'agent' | 'resume' | 'search' | 'pipeline' | 'interview' | 'settings'

export type ResumeVersion = {
  id: string
  name: string
  sections: ResumeSection[]
  createdAt: string
  updatedAt: string
}
