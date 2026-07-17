import { useState } from 'react'
import { useApp } from '../state/AppContext'
import type { SourceKey } from '../types'
import { uid } from '../lib/id'

type Props = { onClose: () => void }

const sourceOptions: { key: SourceKey; label: string }[] = [
  { key: 'boss', label: 'Boss直聘' },
  { key: 'zhilian', label: '智联招聘' },
  { key: 'liepin', label: '猎聘' },
]

export function AddJobModal({ onClose }: Props) {
  const { setJobs, pushToast, importJobsFromJson } = useApp()
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [city, setCity] = useState('北京')
  const [salary, setSalary] = useState('')
  const [source, setSource] = useState<SourceKey>('boss')
  const [tags, setTags] = useState('')
  const [jd, setJd] = useState('')
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')

  function submit() {
    if (!title.trim() || !company.trim()) {
      pushToast('error', '职位名和公司名必填')
      return
    }
    const tagArr = tags
      .split(/[,，、\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    setJobs((list) => [
      {
        id: uid('job'),
        title: title.trim(),
        company: company.trim(),
        city: city.trim() || '待定',
        salary: salary.trim() || '面议',
        source,
        match: 0,
        tags: tagArr,
        experience: '',
        education: '',
        updatedAt: '刚刚',
        link: link.trim(),
        reason: '',
        jd: jd.trim() || undefined,
        applyStatus: 'new',
        note: note.trim() || undefined,
        starred: false,
      },
      ...list,
    ])
    pushToast('success', '已添加岗位')
    onClose()
  }

  function onJsonImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const json = JSON.parse(await file.text())
        const arr = Array.isArray(json) ? json : json.jobs || json.data || [json]
        if (!arr.length) throw new Error('未识别到岗位数组')
        importJobsFromJson(arr)
        pushToast('success', `已导入 ${arr.length} 条岗位`)
        onClose()
      } catch (err) {
        pushToast('error', err instanceof Error ? err.message : 'JSON 格式无效')
      }
    }
    input.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 max-h-[92vh] w-full max-w-[520px] overflow-auto rounded-2xl border border-gray-100 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div className="text-[15px] font-semibold text-gray-900">添加岗位</div>
          <button type="button" onClick={onClose} className="btn text-[12px]">
            关闭
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex gap-3">
            <button type="button" onClick={onJsonImport} className="btn btn-soft flex-1 text-[12px]">
              JSON 批量导入
            </button>
          </div>
          <div className="text-center text-[11px] text-gray-400">
            JSON 格式：{`[{ "title":"...", "company":"...", "city":"...", "salary":"...", "tags":["A","B"], "jd":"...", "source":"boss" }]`}
          </div>

          <div className="border-t border-gray-50 pt-3">
            <label className="mb-1.5 block text-[12px] font-medium text-gray-500">手动录入</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-400">职位名 *</span>
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="高级前端工程师" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-400">公司 *</span>
              <input className="field" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="XX 公司" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-400">城市</span>
              <input className="field" value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-400">薪资</span>
              <input className="field" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="25-40K" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-400">来源</span>
              <select className="field" value={source} onChange={(e) => setSource(e.target.value as SourceKey)}>
                {sourceOptions.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-400">链接</span>
              <input className="field" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] text-gray-400">标签（逗号分隔）</span>
            <input className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="React, TypeScript, 双休" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-gray-400">JD 摘要</span>
            <textarea className="field allow-select min-h-[72px] resize-y" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="粘贴岗位职责和任职要求…" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-gray-400">备注</span>
            <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="跟进备忘" />
          </label>
          <button type="button" onClick={submit} className="btn btn-primary w-full text-[13px]">
            添加岗位
          </button>
        </div>
      </div>
    </div>
  )
}
