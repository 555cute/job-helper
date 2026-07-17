import { useState, useRef } from 'react'
import { IconSpark } from '../components/Icons'
import { ResumePreview } from '../components/ResumePreview'
import { useApp } from '../state/AppContext'
import { api } from '../lib/api'
import { uid } from '../lib/id'
import type { ResumeVersion } from '../types'

export function ResumePage() {
  const {
    resume,
    setResume,
    suggestions,
    applySuggestion,
    runOptimizeResume,
    recomputeJobMatches,
    settings,
    stats,
    runExport,
    pushToast,
    updateSettings,
  } = useApp()

  const [activeId, setActiveId] = useState(resume[0]?.id || '')
  const [versions, setVersions] = useState<ResumeVersion[]>(() => {
    try {
      const raw = localStorage.getItem('job-helper:resume-versions:v1')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'suggestions' | 'pdf'>('suggestions')
  const [optimizing, setOptimizing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleOptimize() {
    setOptimizing(true)
    try {
      await runOptimizeResume()
      pushToast('success', '优化建议已生成，查看右侧面板')
    } catch {
      pushToast('error', '优化失败')
    } finally {
      setOptimizing(false)
    }
  }

  const active = resume.find((s) => s.id === activeId) ?? resume[0]

  async function handleUpload() {
    fileRef.current?.click()
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase()
      // save PDF blob for preview
      if (ext === 'pdf') {
        const blobUrl = URL.createObjectURL(file)
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return blobUrl
        })
      }
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
        setActiveId(data.sections[0]?.id || '')
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
        pushToast('success', `已解析 ${data.sections.length} 段`)
      }
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : '上传失败')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function persistVersions(updated: ResumeVersion[]) {
    setVersions(updated)
    localStorage.setItem('job-helper:resume-versions:v1', JSON.stringify(updated))
  }

  function saveVersion() {
    const name = window.prompt('版本名称（如：前端-Agent方向、全栈方向）')
    if (!name) return
    const v: ResumeVersion = {
      id: uid('ver'),
      name,
      sections: resume.map((s) => ({ ...s })),
      createdAt: new Date().toLocaleString('zh-CN'),
      updatedAt: new Date().toLocaleString('zh-CN'),
    }
    persistVersions([v, ...versions].slice(0, 20))
    pushToast('success', `已保存「${name}」`)
  }

  function loadVersion(v: ResumeVersion) {
    setResume(v.sections)
    setActiveId(v.sections[0]?.id || '')
    setSelectedVersion(v.id)
    pushToast('success', `已切换到「${v.name}」`)
  }

  function deleteVersion(id: string) {
    persistVersions(versions.filter((v) => v.id !== id))
    if (selectedVersion === id) setSelectedVersion(null)
  }

  function cloneVersion(v: ResumeVersion) {
    const name = `${v.name}（副本）`
    const newV: ResumeVersion = {
      id: uid('ver'),
      name,
      sections: v.sections.map((s) => ({ ...s })),
      createdAt: new Date().toLocaleString('zh-CN'),
      updatedAt: new Date().toLocaleString('zh-CN'),
    }
    persistVersions([newV, ...versions])
    pushToast('success', `已克隆为「${name}」`)
  }

  function addSection() {
    const id = uid('sec')
    setResume((list) => [...list, { id, title: '新段落', content: '' }])
    setActiveId(id)
  }

  function removeSection(id: string) {
    setResume((list) => list.filter((s) => s.id !== id))
    if (activeId === id) setActiveId(resume.find((s) => s.id !== id)?.id || '')
  }

  if (!active && resume.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-gray-400">
        <p className="mb-3">暂无简历</p>
        <div className="flex flex-col items-center gap-2">
          <button type="button" onClick={addSection} className="btn btn-primary">
            新建简历
          </button>
          <button type="button" onClick={handleUpload} disabled={uploading} className="btn">
            {uploading ? '解析中…' : '上传 PDF / DOCX'}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov"
            onChange={onFileChange}
          />
          {versions.length > 0 && (
            <button type="button" onClick={() => setShowVersions(true)} className="btn">
              加载版本（{versions.length}）
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid h-full grid-cols-[220px_minmax(0,1fr)_280px] gap-4 bg-white px-6 py-5">
      <aside className="card flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-50 px-3 py-3">
          <span className="text-[13px] font-semibold text-gray-900">结构</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
            {stats.resumeScore}%
          </span>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-auto p-2">
          {resume.map((s) => (
            <div key={s.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => setActiveId(s.id)}
                className={`min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 text-left text-[13px] ${
                  s.id === active.id
                    ? 'bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s.title || '无标题'}
              </button>
              <button
                type="button"
                onClick={() => removeSection(s.id)}
                className="hidden px-1 text-gray-300 group-hover:block hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-50 p-3">
          <button type="button" onClick={addSection} className="btn w-full text-[12px]">
            + 段落
          </button>
          <div className="mt-2 flex flex-col gap-1.5">
            <button type="button" onClick={handleUpload} disabled={uploading} className="btn w-full text-[12px]">
              {uploading ? '解析中…' : '上传 PDF / DOCX'}
            </button>
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx" onChange={onFileChange} />
            <button type="button" onClick={saveVersion} className="btn w-full text-[12px]">
              保存为版本
            </button>
            <button
              type="button"
              onClick={() => setShowVersions((v) => !v)}
              className="btn w-full text-[12px]"
            >
              版本历史（{versions.length}）
            </button>
          </div>
          {showVersions && (
            <div className="mt-2 max-h-[200px] overflow-auto rounded-xl border border-gray-100 p-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={`mb-1 rounded-xl px-2.5 py-2 text-[12px] ${
                    selectedVersion === v.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold text-gray-800">{v.name}</div>
                  <div className="text-[10px] text-gray-400">{v.createdAt}</div>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => loadVersion(v)}
                      className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700"
                    >
                      加载
                    </button>
                    <button
                      type="button"
                      onClick={() => cloneVersion(v)}
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600"
                    >
                      克隆
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVersion(v.id)}
                      className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
              {versions.length === 0 && (
                <div className="py-4 text-center text-[12px] text-gray-400">暂无版本</div>
              )}
            </div>
          )}
        </div>
      </aside>

      <section className="card flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-50 px-4 py-3">
          <input
            value={active.title}
            onChange={(e) =>
              setResume((list) =>
                list.map((s) => (s.id === active.id ? { ...s, title: e.target.value } : s)),
              )
            }
            className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-gray-900 outline-none"
          />
          <button type="button" onClick={() => void runExport('resume')} className="btn h-8 text-[12px]">
            导出
          </button>
          <button type="button" onClick={handleOptimize} disabled={optimizing} className="btn btn-primary h-8 text-[12px] disabled:opacity-50">
            {optimizing ? '优化中…' : 'Agent 优化'}
          </button>
        </div>
        <ResumePreview sections={resume} onUpdate={setResume} />
      </section>

      <aside className="card flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center border-b border-gray-50">
          <button
            type="button"
            onClick={() => setRightTab('suggestions')}
            className={`flex-1 py-2.5 text-center text-[12px] font-medium ${rightTab === 'suggestions' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            建议
          </button>
          {pdfUrl && (
            <button
              type="button"
              onClick={() => setRightTab('pdf')}
              className={`flex-1 py-2.5 text-center text-[12px] font-medium ${rightTab === 'pdf' ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}
            >
              PDF
            </button>
          )}
        </div>

        {rightTab === 'pdf' && pdfUrl ? (
          <embed src={pdfUrl} type="application/pdf" className="min-h-0 flex-1 w-full" />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-gray-50 px-3 py-3">
              <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-900">
                <IconSpark className="h-4 w-4 text-indigo-500" />
                建议
              </div>
              <button type="button" onClick={recomputeJobMatches} className="text-[12px] font-medium text-indigo-600">
                重算匹配
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-xl border p-3 ${
                    s.applied ? 'border-emerald-100 bg-emerald-50/60' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="text-[12.5px] font-semibold text-gray-800">{s.title}</div>
                  <p className="mt-1 text-[12px] leading-5 text-gray-500">{s.text}</p>
                  <button
                    type="button"
                    disabled={s.applied}
                    onClick={() => applySuggestion(s.id)}
                    className="mt-2 text-[12px] font-semibold text-indigo-600 disabled:text-emerald-600"
                  >
                    {s.applied ? '已应用' : '应用'}
                  </button>
                </div>
              ))}
              {suggestions.length === 0 && (
                <div className="py-10 text-center text-[12px] text-gray-400">暂无建议</div>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
