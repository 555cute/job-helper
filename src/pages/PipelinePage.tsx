import { useMemo, useState } from 'react'
import { useApp } from '../state/AppContext'
import { SourceBadge } from '../components/SourceBadge'
import { AddJobModal } from '../components/AddJobModal'
import type { ApplyStatus, JobPost } from '../types'

const columns: { status: ApplyStatus; label: string; empty: string }[] = [
  { status: 'saved', label: '收藏', empty: '暂无收藏' },
  { status: 'new', label: '待投递', empty: '暂无待投' },
  { status: 'applied', label: '已投递', empty: '暂无已投' },
  { status: 'interviewing', label: '面试中', empty: '暂无面试' },
  { status: 'offer', label: 'Offer', empty: '暂无Offer' },
  { status: 'rejected', label: '已淘汰', empty: '暂无淘汰' },
]

const nextStatus: Record<ApplyStatus, ApplyStatus | null> = {
  new: 'applied', saved: 'applied', applied: 'interviewing',
  interviewing: 'offer', offer: 'archived', rejected: 'archived', archived: null,
}

const statusLabel: Record<string, string> = {
  new: '待投递', saved: '收藏', applied: '已投递',
  interviewing: '面试中', offer: 'Offer', rejected: '已淘汰', archived: '归档',
}

export function PipelinePage() {
  const {
    jobs, setJobStatus, toggleStarJob, removeJob,
    stats, setNav,
  } = useApp()
  const [showAddJob, setShowAddJob] = useState(false)
  const [filter, setFilter] = useState('')

  const filteredJobs = useMemo(() => {
    if (!filter.trim()) return jobs
    const q = filter.trim().toLowerCase()
    return jobs.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      j.city.includes(q) ||
      j.tags.some(t => t.toLowerCase().includes(q)) ||
      (j.note || '').toLowerCase().includes(q)
    )
  }, [jobs, filter])

  const byStatus = useMemo(() => {
    const map = new Map<ApplyStatus, JobPost[]>()
    for (const c of columns) map.set(c.status, [])
    for (const j of filteredJobs) {
      const s = j.applyStatus || 'new'
      if (!map.has(s as ApplyStatus)) map.set(s as ApplyStatus, [])
      map.get(s as ApplyStatus)!.push(j)
    }
    return map
  }, [filteredJobs])

  const total = jobs.length

  return (
    <div className="flex h-full flex-col bg-white px-6 py-5">
      <div className="card mb-3 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <input
            className="field w-48 text-[12px]"
            placeholder="筛选岗位/公司/标签…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          {filter && (
            <span className="text-[11px] text-gray-400">
              匹配 {filteredJobs.length}/{total}
            </span>
          )}
          <span className="text-[12px] text-gray-400">收藏 {stats.starredCount} · 已投 {stats.appliedCount}</span>
          <button type="button" onClick={() => setNav('search')} className="text-[12px] text-indigo-600">去检索</button>
        </div>
        <button type="button" onClick={() => setShowAddJob(true)} className="btn btn-soft text-[12px]">
          + 添加岗位
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid h-full grid-cols-6 gap-2.5" style={{ minWidth: 1100 }}>
          {columns.map((col) => {
            const list = byStatus.get(col.status) || []
            return (
              <div key={col.status} className="flex flex-1 flex-col rounded-xl border border-gray-100 bg-gray-50/50 p-2.5 min-h-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[12px] font-semibold text-gray-700">{col.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-gray-100">{list.length}</span>
                </div>
                <div className="flex-1 space-y-1 overflow-auto">
                  {list.map((j) => (
                    <div key={j.id} className="rounded-lg bg-white p-2 shadow-sm border border-gray-100">
                      <div className="flex items-start gap-1">
                        <span className="min-w-0 flex-1 text-[12px] font-semibold text-gray-800 truncate">{j.title}</span>
                        <button type="button" className={`shrink-0 text-[12px] ${j.starred ? 'text-amber-500' : 'text-gray-300'}`} onClick={() => toggleStarJob(j.id)}>★</button>
                        <button type="button" className="shrink-0 text-[12px] text-gray-300 hover:text-red-500" onClick={() => removeJob(j.id)}>✕</button>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400 truncate">
                        <SourceBadge source={j.source} /> {j.company} · {j.city}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-gray-500">{j.salary}</div>
                      {j.note && <div className="mt-1 truncate rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">📝 {j.note}</div>}
                      <div className="mt-1 flex gap-0.5">
                        {nextStatus[j.applyStatus || 'new'] && (
                          <button className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100" onClick={() => setJobStatus(j.id, nextStatus[j.applyStatus || 'new']!)}>
                            → {statusLabel[nextStatus[j.applyStatus || 'new']!]}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-[11px] text-gray-300">{col.empty}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {jobs.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-20 text-center">
          <div>
            <div className="text-[14px] text-gray-400">暂无岗位</div>
            <div className="mt-2 flex gap-2 justify-center">
              <button type="button" onClick={() => setShowAddJob(true)} className="btn btn-primary text-[12px]">手动添加</button>
              <button type="button" onClick={() => setNav('search')} className="btn text-[12px]">去检索</button>
            </div>
          </div>
        </div>
      )}

      {showAddJob && <AddJobModal onClose={() => setShowAddJob(false)} />}
    </div>
  )
}
