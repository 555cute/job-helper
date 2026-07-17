import { useEffect, useRef, useState } from 'react'
import { IconSend, IconSpark } from '../components/Icons'
import { useApp } from '../state/AppContext'
import { api } from '../lib/api'
import { uid } from '../lib/id'

type InterviewMsg = {
  id: string
  role: 'interviewer' | 'user'
  content: string
  stage: string
  round: number
}

export function InterviewPage() {
  const { resume, jobs, settings, pushToast } = useApp()
  const [messages, setMessages] = useState<InterviewMsg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [jobIndex, setJobIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [ended, setEnded] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedJob = jobs[jobIndex] || null

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function startInterview() {
    if (!resume.length) {
      pushToast('error', '请先上传简历')
      return
    }
    setStarted(true)
    setEnded(false)

    const initialMsg: InterviewMsg = {
      id: uid('iv'),
      role: 'interviewer',
      content: selectedJob
        ? `欢迎参加${selectedJob.company}「${selectedJob.title}」的模拟面试。我们开始吧——请简单介绍一下你自己。`
        : '欢迎参加模拟面试。我们开始吧——请简单介绍一下你自己。',
      stage: '开场',
      round: 0,
    }
    setMessages([initialMsg])
  }

  async function sendAnswer() {
    const text = input.trim()
    if (!text || busy || ended) return
    setBusy(true)
    setInput('')

    const userMsg: InterviewMsg = { id: uid('iv'), role: 'user', content: text, stage: '', round: messages.length }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)

    try {
      const history = newMessages.map((m) => ({ role: m.role, content: m.content }))
      const data = await api.interview({
        message: text,
        resume,
        job: selectedJob,
        settings,
        history,
      })

      const interviewerMsg: InterviewMsg = {
        id: uid('iv'),
        role: 'interviewer',
        content: data.reply,
        stage: data.stage || '',
        round: data.round || newMessages.length,
      }
      setMessages((m) => [...m, interviewerMsg])

      if (data.stage === '收尾阶段' || data.round >= 9 || data.reply.includes('面试总结')) {
        setEnded(true)
      }
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '请求失败')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setMessages([])
    setStarted(false)
    setEnded(false)
  }

  if (!started) {
    return (
      <div className="flex h-full items-center justify-center bg-white px-6">
        <div className="card w-full max-w-[520px] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <IconSpark className="h-8 w-8" />
          </div>
          <h2 className="text-[18px] font-semibold text-gray-900">模拟面试</h2>
          <p className="mt-2 text-[13px] leading-6 text-gray-500">
            AI 面试官将根据你的简历{selectedJob ? `和「${selectedJob.title}」岗位` : ''}提问
          </p>

          {jobs.length > 0 && (
            <div className="mt-5 text-left">
              <label className="mb-1.5 block text-[12px] font-medium text-gray-500">选择目标岗位（可选）</label>
              <select
                className="field"
                value={jobIndex}
                onChange={(e) => setJobIndex(Number(e.target.value))}
              >
                <option value={-1}>通用面试（不指定岗位）</option>
                {jobs
                  .filter((j) => j.starred || j.applyStatus !== 'new')
                  .map((j, i) => (
                    <option key={j.id} value={i}>
                      {j.starred ? '★ ' : ''}{j.title} @ {j.company}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => void startInterview()}
            disabled={!resume.length}
            className="btn btn-primary mt-6 w-full text-[14px] disabled:opacity-50"
          >
            {resume.length ? '开始面试' : '请先上传简历'}
          </button>

          {jobs.length === 0 && (
            <p className="mt-3 text-[12px] text-gray-400">
              暂未添加岗位，将进行通用面试
            </p>
          )}
        </div>
      </div>
    )
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
              <div className="text-[13px] font-semibold text-gray-900">模拟面试</div>
              <div className="text-[11px] text-gray-400">
                {selectedJob ? `${selectedJob.title} @ ${selectedJob.company}` : '通用面试'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!ended && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-600">
                {messages[messages.length - 1]?.stage || '进行中'}
              </span>
            )}
            {ended && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600">
                已完成
              </span>
            )}
            <button type="button" onClick={reset} className="text-[12px] text-gray-400 hover:text-gray-600">
              重新开始
            </button>
          </div>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-gray-50/50 p-5">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-6 whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'rounded-br-md bg-indigo-600 text-white'
                    : 'rounded-bl-md border border-gray-100 bg-white text-gray-800 shadow-sm'
                }`}
              >
                {m.role === 'interviewer' && (
                  <div className="mb-1 text-[11px] font-semibold text-indigo-600">
                    {m.stage || '面试官'}
                  </div>
                )}
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <div className="text-[12px] text-gray-400">面试官正在思考…</div>
              </div>
            </div>
          )}
        </div>

        {!ended && (
          <div className="border-t border-gray-50 bg-white p-4">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void sendAnswer()
                  }
                }}
                rows={2}
                placeholder="输入你的回答 · Enter 发送"
                className="field allow-select min-h-[56px] flex-1 resize-none"
              />
              <button
                type="button"
                onClick={() => void sendAnswer()}
                disabled={busy || !input.trim() || (!settings.agent.enabled && true)}
                className="btn btn-primary h-[56px] px-4 disabled:opacity-50"
              >
                <IconSend className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
