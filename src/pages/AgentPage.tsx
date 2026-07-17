import { useEffect, useRef, useState } from 'react'
import { IconSend, IconSpark, IconUpload } from '../components/Icons'
import { useApp } from '../state/AppContext'
import { api } from '../lib/api'

const presets = [
  { label: '简历教练', text: '请扮演简历教练：我会提供我的简历和 JD，请通过多轮提问深度挖掘我的经历，用 STAR 法则生成定制化简历和面试策略文档' },
  { label: '职位猎人', text: '请扮演职位猎人：帮我精准检索岗位。先采集我的求职意向（岗位/行业/城市/薪资/意向企业），然后搜索主流招聘平台，输出结构化岗位清单和投递优先级' },
  { label: '三方评估', text: '请扮演三方评估师：从 HR、业务 BP、第三方三个视角评测我的简历。逐条拆解 JD，给出行业竞争力分析、模拟面试题和强化规划' },
]

export function AgentPage() {
  const {
    messages,
    sendAgent,
    seedPrompt,
    setSeedPrompt,
    clearMessages,
    settings,
    stats,
    pushToast,
  } = useApp()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let base64 = ''
      for (let i = 0; i < bytes.length; i += 8192) base64 += String.fromCharCode(...bytes.slice(i, i + 8192))
      base64 = btoa(base64)
      const data = await api.parseResumeFile(base64, file.name, settings)

      const text = data.rawText || data.sections?.map(s => s.content).join('\n\n') || ''
      if (!text) {
        pushToast('error', '无法提取文件内容')
        return
      }
      await send(text.slice(0, 10000))
    } catch (err) {
      pushToast('error', '上传失败: ' + (err instanceof Error ? err.message : ''))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (seedPrompt) {
      setInput(seedPrompt)
      setSeedPrompt(null)
    }
  }, [seedPrompt, setSeedPrompt])

  async function send(text: string) {
    if (!text.trim() || busy) return
    setBusy(true)
    setInput('')
    try {
      await sendAgent(text)
    } finally {
      setBusy(false)
    }
  }

  const grouped: { date: string; msgs: typeof messages }[] = []
  let last = ''
  for (const m of messages) {
    const d = m.time.slice(0, 10)
    if (d !== last) {
      last = d
      grouped.push({ date: d, msgs: [] })
    }
    grouped[grouped.length - 1].msgs.push(m)
  }

  return (
    <div className="flex h-full flex-col bg-white px-6 py-5">
      <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-50 px-4 py-3">
          <div className="inline-flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <IconSpark className="h-4 w-4" />
            </span>
            <div>
              <div className="text-[13px] font-semibold text-gray-900">Agent 对话</div>
              <div className="text-[11px] text-gray-400">
                {settings.agent.enabled
                  ? `${settings.agent.provider} · ${settings.agent.model}`
                  : 'Agent 已关闭'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-gray-400">
            <span>任务 {stats.runningTasks}</span>
            <span>|</span>
            <span>收藏 {stats.starredCount}</span>
            <button type="button" onClick={clearMessages} className="hover:text-gray-700">
              清空
            </button>
          </div>
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-gray-50/50 p-5"
        >
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-[14px] font-semibold text-gray-400">Agent 求职助手</div>
                <div className="mt-2 text-[12px] leading-6 text-gray-400">
                  输入求职需求开始对话
                  <br />
                  · 粘贴 JD 让我分析匹配
                  <br />
                  · 按岗位改写简历
                  <br />
                  · 检索 Boss/智联岗位
                  <br />· 查看投递跟进状态
                </div>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-6 whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'rounded-br-md bg-indigo-600 text-white'
                    : m.role === 'system'
                      ? 'border border-dashed border-gray-200 bg-white text-gray-500'
                      : 'rounded-bl-md border border-gray-100 bg-white text-gray-800 shadow-sm'
                }`}
              >
                {m.role === 'agent' && (
                  <div className="mb-1 text-[11px] font-semibold text-indigo-600">Agent</div>
                )}
                {m.content}
                {m.role === 'agent' && m.id === messages.filter((x) => x.role === 'agent').slice(-1)[0]?.id && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-100 pt-2">
                    <QuickBtn onClick={() => send('帮我改简历')}>改简历</QuickBtn>
                    <QuickBtn onClick={() => send('检索岗位')}>检索</QuickBtn>
                    <QuickBtn onClick={() => send('写话术')}>话术</QuickBtn>
                    <QuickBtn onClick={() => send('跟进情况')}>跟进</QuickBtn>
                  </div>
                )}
                <div className={`mt-1 text-[10px] ${m.role === 'user' ? 'text-white/70' : 'text-gray-400'}`}>
                  {m.time}
                </div>
              </div>
            </div>
          ))}
          {busy && <div className="text-[12px] text-gray-400">Agent 正在编排…</div>}
        </div>

        <div className="border-t border-gray-50 bg-white p-4">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            {presets.map((p) => (
              <button key={p.label} type="button" onClick={() => void send(p.text)} className="chip hover:bg-indigo-50 hover:text-indigo-700">
                {p.label}
              </button>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="chip hover:bg-indigo-50 hover:text-indigo-700">
              <IconUpload className="h-3 w-3" />
              {uploading ? '解析中…' : '上传文件'}
            </button>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.md,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov" onChange={handleFileUpload} />
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              rows={2}
              placeholder="输入指令 · Enter 发送 · 也可粘贴 JD 让我分析"
              className="field allow-select min-h-[56px] flex-1 resize-none"
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={busy || !input.trim() || !settings.agent.enabled}
              className="btn btn-primary h-[56px] px-4 disabled:opacity-50"
            >
              <IconSend className="h-4 w-4" />
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
    >
      {children}
    </button>
  )
}
