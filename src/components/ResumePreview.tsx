import { useState } from 'react'
import type { ResumeSection } from '../types'
import { useApp } from '../state/AppContext'

const LABELS: Record<string, string> = {
  name: '个人信息', phone: '电话', email: '邮箱', city: '城市', location: '地址',
  summary: '个人优势', exp: '工作经历', proj: '项目经验',
  skills: '技能关键词', edu: '教育背景', cert: '证书/荣誉', lang: '语言',
  target: '求职目标', self: '自我评价',
}

function toLabel(t: string) { return LABELS[t] || t }

export function ResumePreview({ sections, onUpdate }: { sections: ResumeSection[]; onUpdate: (r: ResumeSection[] | ((prev: ResumeSection[]) => ResumeSection[])) => void }) {
  const { settings, updateSettings } = useApp()
  const [editing, setEditing] = useState<string | null>(null)
  const [editingMeta, setEditingMeta] = useState(false)

  function updateSection(id: string, p: Partial<ResumeSection>) { onUpdate((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s))) }
  function deleteSection(id: string) { onUpdate((l) => l.filter((s) => s.id !== id)) }

  return (
    <div className="allow-select min-h-0 flex-1 overflow-auto bg-gray-50 p-6">
      <div className="mx-auto max-w-[780px] bg-white shadow-sm border border-gray-100 rounded-2xl p-10" style={{ minHeight: 900 }}>
        <div className="border-b-2 border-indigo-500 pb-5 mb-8">
          {editingMeta ? (
            <div className="space-y-2">
              <input className="text-[26px] font-bold text-gray-900 outline-none w-full bg-gray-50 rounded px-2 py-1" value={settings.resume.targetRole} onChange={e => updateSettings({ resume: { ...settings.resume, targetRole: e.target.value } })} placeholder="目标岗位" />
              <div className="flex gap-2">
                <input className="text-[12px] text-gray-500 outline-none bg-gray-50 rounded px-2 py-1 flex-1" value={settings.resume.targetCities || ''} onChange={e => updateSettings({ resume: { ...settings.resume, targetCities: e.target.value } })} placeholder="期望城市" />
                <input className="text-[12px] text-gray-500 outline-none bg-gray-50 rounded px-2 py-1 w-40" value={settings.resume.targetSalary || ''} onChange={e => updateSettings({ resume: { ...settings.resume, targetSalary: e.target.value } })} placeholder="期望薪资" />
              </div>
              <button type="button" onClick={() => setEditingMeta(false)} className="text-[11px] text-indigo-600">完成</button>
            </div>
          ) : (
            <div onClick={() => setEditingMeta(true)} className="cursor-pointer group">
              <h1 className="text-[26px] font-bold tracking-tight text-gray-900">{settings.resume.targetRole || '点击设置求职目标'}</h1>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-gray-400">
                {settings.resume.targetCities && <span>{settings.resume.targetCities}</span>}
                {settings.resume.targetSalary && <span>期望 {settings.resume.targetSalary}</span>}
              </div>
              <span className="opacity-0 group-hover:opacity-100 text-[10px] text-indigo-500 ml-1">编辑</span>
            </div>
          )}
        </div>

        {sections.length === 0 ? (
          <div className="py-16 text-center text-[14px] text-gray-300">去 <strong className="text-indigo-500">Agent 页面</strong> 说「帮我写简历」，AI 会引导你逐段完成</div>
        ) : (
          sections.map((s) => {
            if (!s.content?.trim()) return null
            return (
              <section key={s.id} className="group relative mb-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-semibold text-gray-800">
                    <span className="inline-block w-1 h-3.5 rounded-sm bg-indigo-500 mr-1.5 align-middle" />{toLabel(s.title)}
                  </h3>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <button type="button" onClick={() => setEditing(s.id)} className="text-[11px] text-gray-400 hover:text-indigo-600">编辑</button>
                    <button type="button" onClick={() => deleteSection(s.id)} className="text-[11px] text-gray-400 hover:text-red-500">删除</button>
                  </div>
                </div>
                <div className="text-[13px] leading-7 text-gray-600 whitespace-pre-wrap cursor-pointer" onClick={() => setEditing(s.id)}>{s.content}</div>
              </section>
            )
          })
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-[600px] p-5" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <input value={sections.find(s => s.id === editing)!.title} onChange={e => updateSection(editing, { title: e.target.value })} className="text-[14px] font-semibold text-gray-900 outline-none" />
              <button type="button" onClick={() => setEditing(null)} className="btn text-[12px]">完成</button>
            </div>
            <textarea value={sections.find(s => s.id === editing)!.content} onChange={e => updateSection(editing, { content: e.target.value })} className="field allow-select min-h-[280px] resize-y text-[13px] leading-6" />
          </div>
        </div>
      )}
    </div>
  )
}
