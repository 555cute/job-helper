import { useState, useRef } from 'react'
import { useApp } from '../state/AppContext'
import { api } from '../lib/api'

export function Onboarding({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const { parseResume, pushToast, settings, updateSettings, setResume, setHasResume } = useApp()
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)

  function handleSkip() {
    localStorage.setItem('job-helper:onboarded:v2', '1')
    onSkip()
  }

  return (
    <div className="flex h-full items-center justify-center bg-white">
      <div className="mx-4 w-full max-w-[560px] text-center">
        <div className="mb-2 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
            <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
          欢迎使用 {settings.general.appName}
        </h1>

        <div className="mt-4 flex items-center justify-center gap-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ${
                n <= step
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {n < step ? '✓' : n}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-gray-400">
          {step === 1 ? '配置 Agent，让 AI 帮您优化简历' : '上传简历，Agent 自动分析'}
        </p>

        {step === 1 ? (
          <AgentStep
            settings={settings}
            updateSettings={updateSettings}
            pushToast={pushToast}
            busy={busy}
            setBusy={setBusy}
            onNext={() => setStep(2)}
            onSkip={handleSkip}
          />
        ) : (
          <ResumeStep
            parseResume={parseResume}
            pushToast={pushToast}
            onDone={onDone}
            onSkip={handleSkip}
            settings={settings}
            updateSettings={updateSettings}
            setResume={setResume}
            setHasResume={setHasResume}
          />
        )}
      </div>
    </div>
  )
}

function AgentStep({
  settings,
  updateSettings,
  pushToast,
  busy,
  setBusy,
  onNext,
  onSkip,
}: {
  settings: any
  updateSettings: any
  pushToast: any
  busy: boolean
  setBusy: (v: boolean) => void
  onNext: () => void
  onSkip: () => void
}) {
  const [provider, setProvider] = useState(settings.agent.provider)
  const [baseUrl, setBaseUrl] = useState(settings.agent.baseUrl)
  const [apiKey, setApiKey] = useState(settings.agent.apiKey)
  const [model, setModel] = useState(settings.agent.model)
  const [testResult, setTestResult] = useState('')

  function saveAndNext() {
    updateSettings({
      agent: {
        ...settings.agent,
        enabled: true,
        provider,
        baseUrl,
        apiKey,
        model,
      },
    })
    onNext()
  }

  async function handleTest() {
    setBusy(true)
    setTestResult('')
    try {
      const data = await api.testAgent({ provider, baseUrl, apiKey, model })
      if (!data.ok) throw new Error(data.error || '连接失败')
      setTestResult(data.message || '连接成功')
      pushToast('success', data.message || '连接成功')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTestResult(msg)
      pushToast('error', msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 space-y-4 text-left">
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-gray-500">Provider</span>
        <select
          className="field"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="openai-compatible">OpenAI Compatible</option>
          <option value="mock">Mock（默认体验）</option>
        </select>
      </label>

      {provider === 'openai-compatible' && (
        <>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-gray-500">Base URL</span>
            <input
              className="field"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://127.0.0.1:11434/v1"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-gray-500">API Key</span>
            <input
              type="password"
              className="field"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-gray-500">模型</span>
            <input
              className="field"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini / qwen2.5:7b"
            />
          </label>
        </>
      )}

      {provider === 'mock' && (
        <div className="rounded-xl bg-gray-50 p-4 text-center text-[13px] leading-6 text-gray-500">
          Mock 模式使用本地规则，不需任何配置。
          <br />
          之后可以在「设置 → Agent」中随时切换。
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onSkip} className="text-[13px] font-medium text-gray-400 underline hover:text-gray-600">
          跳过
        </button>
        <div className="flex gap-2">
          {provider !== 'mock' && (
            <button type="button" onClick={() => void handleTest()} disabled={busy} className="btn text-[13px] disabled:opacity-50">
              {busy ? '测试中…' : '测试连接'}
            </button>
          )}
          <button type="button" onClick={saveAndNext} className="btn btn-primary text-[13px]">
            下一步
          </button>
        </div>
      </div>
      {testResult && (
        <p className="text-center text-[12px] text-gray-500">{testResult}</p>
      )}
    </div>
  )
}

function ResumeStep({
  parseResume,
  pushToast,
  onDone,
  onSkip,
  settings,
  updateSettings,
  setResume,
  setHasResume,
}: {
  parseResume: (text: string) => Promise<void>
  pushToast: any
  onDone: () => void
  onSkip: () => void
  settings: any
  updateSettings: any
  setResume: any
  setHasResume: any
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()

    // PDF / DOCX → 后端解析
    if (ext === 'pdf' || ext === 'docx') {
      setBusy(true)
      try {
        const buf = await file.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let base64 = ''
        for (let i = 0; i < bytes.length; i += 8192) {
          base64 += String.fromCharCode(...bytes.slice(i, i + 8192))
        }
        base64 = btoa(base64)
        const data = await api.parseResumeFile(base64, file.name, settings)
        if (data.sections?.length) {
          setResume(data.sections)
          if (data.config) {
            updateSettings({
              resume: {
                ...settings.resume,
                targetRole: data.config.targetRole || settings.resume.targetRole,
                targetCities: data.config.targetCities || settings.resume.targetCities,
                targetSalary: data.config.targetSalary || settings.resume.targetSalary,
                keywords: data.config.keywords || settings.resume.keywords,
              },
            })
          }
          pushToast('success', `已解析 ${data.sections.length} 段简历`)
          localStorage.setItem('job-helper:onboarded:v2', '1')
          setHasResume(true)
          onDone()
        } else {
          pushToast('error', '文件解析失败')
        }
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : '文件解析失败')
      } finally {
        setBusy(false)
      }
      return
    }

    // TXT / MD → 本地解析
    const buf = await file.arrayBuffer()
    const view = new Uint8Array(buf)
    // BOM 检测
    if (view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) {
      const txt = new TextDecoder('utf-8').decode(buf.slice(3))
      setText(txt)
      await doParse(txt)
      return
    }
    // 尝试 UTF-8，失败则 GBK
    let txt = ''
    try {
      txt = new TextDecoder('utf-8', { fatal: true }).decode(buf)
    } catch {
      txt = new TextDecoder('gbk').decode(buf)
    }
    setText(txt)
    await doParse(txt)
  }

  async function doParse(content: string) {
    if (!content.trim()) {
      pushToast('error', '请粘贴或上传简历文本')
      return
    }
    setBusy(true)
    try {
      await parseResume(content)
      onDone()
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '解析失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className={`rounded-2xl border p-2 transition ${drag ? 'border-indigo-400 bg-indigo-50' : 'border-dashed border-gray-200 hover:border-gray-300'}`}>
        <div
          className="rounded-xl bg-gray-50 py-10"
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            const file = e.dataTransfer.files[0]
            if (file) void handleFile(file)
          }}
        >
          <div className="text-[14px] font-medium text-gray-600">拖拽简历到此处</div>
              <div className="mt-2 text-[12px] text-gray-400">支持 .pdf / .docx / .png / .jpg / .mp4 等</div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-3 btn text-[12px]"
            disabled={busy}
          >
            选择文件
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
                accept=".pdf,.docx,.md,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-[12px] text-gray-400">或者直接粘贴</span>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`以 Markdown 或纯文本格式粘贴你的简历内容，例如：\n\n## 个人优势\n5 年前端经验，熟悉 React / TypeScript / 工程化…\n\n## 工作经历\n字节跳动 · 高级前端工程师 · 2021-2025\n负责核心业务前端架构与性能优化…\n\n## 技能\nReact, TypeScript, Node.js…`}
        className="field allow-select min-h-[140px] resize-y"
        disabled={busy}
      />

      <button
        type="button"
        onClick={() => void doParse(text)}
        disabled={busy || !text.trim()}
        className="btn btn-primary w-full text-[14px] disabled:opacity-50"
      >
        {busy ? 'Agent 正在解析简历…' : '开始使用'}
      </button>

      <div className="flex items-center justify-center gap-6">
        <button type="button" onClick={onSkip} className="text-[13px] font-medium text-gray-400 underline hover:text-gray-600">
          跳过，直接进入
        </button>
        <p className="text-[11px] text-gray-400">
          数据仅存储在本地浏览器中，不会上传到任何服务器。
        </p>
      </div>
    </div>
  )
}
