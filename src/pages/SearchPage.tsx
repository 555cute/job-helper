import { useMemo, useState } from 'react'
import { SourceBadge } from '../components/SourceBadge'
import { IconExternal, IconSearch } from '../components/Icons'
import { AddJobModal } from '../components/AddJobModal'
import { InterviewModal } from '../components/InterviewModal'
import { useApp } from '../state/AppContext'
import { copyText } from '../lib/export'
import type { ApplyStatus, SourceFilter, SourceKey, JobPost } from '../types'

const sourceTabs: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'boss', label: 'Boss' },
  { key: 'zhilian', label: '智联' },
  { key: 'liepin', label: '猎聘' },
]

const cityList = [
  '全国', '北京', '上海', '深圳', '杭州', '广州', '成都', '南京', '武汉', '西安',
  '苏州', '长沙', '天津', '重庆', '厦门', '合肥', '郑州', '济南', '青岛', '东莞',
  '佛山', '宁波', '福州', '无锡', '大连', '沈阳', '昆明', '南昌', '南宁', '贵阳',
  '哈尔滨', '长春', '石家庄', '太原', '海口', '珠海', '惠州', '中山', '常州', '南通',
  '徐州', '温州', '绍兴', '嘉兴', '金华', '台州', '泉州', '烟台', '潍坊', '临沂',
]

const applyStatuses: ApplyStatus[] = [
  'new',
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected',
  'archived',
]

export function SearchPage() {
  const {
    resume,
    settings,
    updateSettings,
    runSearch,
    addJobsToPipeline,
    toggleStarJob,
    setJobStatus,
    setJobNote,
    generatePitchForJob,
    exportPackageForJob,
    pushToast,
  } = useApp()
  const [interviewJob, setInterviewJob] = useState<JobPost | null>(null)
  const [showAddJob, setShowAddJob] = useState(false)

  const [source, setSource] = useState<SourceFilter>('all')
  const [keyword, setKeyword] = useState(settings.search.defaultKeyword)
  const [city, setCity] = useState(settings.search.defaultCity)
  const [minSalary, setMinSalary] = useState(String(settings.search.minSalaryK))
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchResults, setSearchResults] = useState<JobPost[]>([])
  const [detailId, setDetailId] = useState<string | null>(null)

  const list = useMemo(() => {
    let rows = [...searchResults]
    if (source !== 'all') rows = rows.filter((j) => j.source === source)

    const q = keyword.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.tags.some((t) => t.toLowerCase().includes(q)) ||
          (j.note || '').toLowerCase().includes(q),
      )
    }
    if (city && city !== '全国') rows = rows.filter((j) => j.city.includes(city))
    if (settings.search.onlyHighMatch) {
      rows = rows.filter((j) => j.match >= settings.search.highMatchThreshold)
    }
    const sort = settings.search.sortBy
    if (sort === 'salary') {
      rows.sort((a, b) => {
        const sa = Number((a.salary.match(/\d+/)?.[0]) || 0)
        const sb = Number((b.salary.match(/\d+/)?.[0]) || 0)
        return sb - sa
      })
    } else if (sort === 'updated') {
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    } else {
      rows.sort((a, b) => b.match - a.match)
    }
    return rows
  }, [searchResults, source, keyword, city, settings.search])

  const active = list.find((j) => j.id === detailId) || list[0]

  async function onSearch() {
    setSearching(true)
    try {
      const results = await runSearch({
        keyword,
        city,
        minSalaryK: Number(minSalary) || 0,
        sources: source === 'all' ? undefined : [source],
      })
      setSearchResults(results || [])
      setSelected(new Set())
      setDetailId(null)
    } finally {
      setSearching(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleAll() {
    if (selected.size === list.length) setSelected(new Set())
    else setSelected(new Set(list.map(j => j.id)))
  }
  function addSelected() {
    const picked = list.filter(j => selected.has(j.id))
    if (!picked.length) return
    addJobsToPipeline(picked)
    setSearchResults(prev => prev.filter(j => !selected.has(j.id)))
    setSelected(new Set())
  }

  return (
    <div className="flex h-full flex-col gap-4 bg-white px-6 py-5">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-50 p-3">
          <IconSearch className="h-4 w-4 text-gray-400 shrink-0" />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSearch() }} className="field min-w-[140px] flex-1" placeholder="岗位关键词" />
          <select value={city} onChange={(e) => setCity(e.target.value)} className="field w-24">
            {cityList.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={minSalary} onChange={(e) => setMinSalary(e.target.value)} className="field w-20" placeholder="最低K" />
          <button type="button" onClick={() => void onSearch()} disabled={searching} className="btn btn-primary disabled:opacity-60">{searching ? '检索中…' : '检索'}</button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
          {sourceTabs.map((s) => {
            const disabled = s.key !== 'all' && !settings.sources[s.key as SourceKey].enabled
            return <button key={s.key} type="button" disabled={disabled} onClick={() => setSource(s.key)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium disabled:opacity-40 ${source === s.key ? 'bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-indigo-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >{s.label}</button>
          })}
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-[11px] text-gray-400">排序</span>
          <select value={settings.search.sortBy} onChange={(e) => updateSettings({ search: { ...settings.search, sortBy: e.target.value as any } })}
            className="rounded-full bg-gray-100 px-3 py-1 text-[12px] font-medium text-gray-700 outline-none"
          >
            <option value="match">匹配度</option>
            <option value="salary">薪资</option>
            <option value="updated">最新</option>
          </select>
          <span className="ml-auto text-[12px] text-gray-400">{list.length} 条</span>
          {selected.size > 0 && (
            <button type="button" onClick={addSelected} className="btn btn-primary text-[12px]">加入待投递 ({selected.size})</button>
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_0.85fr] gap-4">
        <section className="card flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-gray-50 px-4 py-3 text-[13px] font-semibold text-gray-900">
            结果列表
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-gray-50 text-[11px] text-gray-400">
                <tr>
                  <th className="px-3 py-2.5 font-medium w-8">
                    <input type="checkbox" checked={selected.size === list.length && list.length > 0} onChange={toggleAll} className="accent-indigo-600" />
                  </th>
                  <th className="px-3 py-2.5 font-medium">★</th>
                  <th className="px-3 py-2.5 font-medium">职位</th>
                  <th className="px-3 py-2.5 font-medium">状态</th>
                  <th className="px-3 py-2.5 font-medium">匹配</th>
                </tr>
              </thead>
              <tbody>
                {list.map((j) => (
                  <tr
                    key={j.id}
                    onClick={() => setDetailId(j.id)}
                    className={`cursor-pointer border-t border-gray-50 ${
                      detailId === j.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-3 py-3 w-8">
                      <input type="checkbox" checked={selected.has(j.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(j.id) }} className="accent-indigo-600" />
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className={`text-[14px] ${j.starred ? 'text-amber-500' : 'text-gray-300'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleStarJob(j.id)
                        }}
                        title="收藏"
                      >
                        ★
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-800">{j.title}</div>
                      <div className="flex items-center gap-1.5 text-[12px] text-gray-400">
                        <SourceBadge source={j.source} />
                        {j.company} · {j.city}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500">{statusLabel(j.applyStatus)}</td>
                    <td className="px-3 py-3 font-semibold tabular-nums">{j.match}</td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center text-gray-400">
                      无结果
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card flex min-h-0 flex-col overflow-hidden">
          <div className="border-b border-gray-50 px-4 py-3 text-[13px] font-semibold text-gray-900">
            详情 / 跟进
          </div>
          {active ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[16px] font-semibold text-gray-900">{active.title}</h3>
                  <p className="mt-1 text-[13px] text-gray-500">
                    {active.company} · {active.city}
                  </p>
                </div>
                <SourceBadge source={active.source} />
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-orange-50 px-2.5 py-1 text-[12px] font-semibold text-orange-600">
                  {active.salary}
                </span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-600">
                  匹配 {active.match}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {active.tags.map((t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ))}
              </div>

              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-500">投递状态</span>
                <select
                  className="field"
                  value={active.applyStatus || 'new'}
                  onChange={(e) => setJobStatus(active.id, e.target.value as ApplyStatus)}
                >
                  {applyStatuses.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-gray-500">备注</span>
                <textarea
                  className="field allow-select min-h-[72px] resize-y"
                  value={active.note || ''}
                  onChange={(e) => setJobNote(active.id, e.target.value)}
                  placeholder="面试时间、联系人、注意点…"
                />
              </label>

              <div className="rounded-xl bg-gray-50 p-3 text-[12.5px] leading-6 text-gray-600">
                {active.reason}
              </div>

              {(active.gaps?.length || active.missingKeywords?.length) && (
                <div className="space-y-1 text-[12.5px] text-gray-600">
                  {active.gaps?.map((g) => (
                    <div key={g}>· {g}</div>
                  ))}
                  {active.missingKeywords?.length ? (
                    <div>建议关键词：{active.missingKeywords.join('、')}</div>
                  ) : null}
                </div>
              )}

              {active.pitch && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-[12.5px] leading-6 text-gray-800">
                  {active.pitch}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => toggleStarJob(active.id)}
                >
                  {active.starred ? '取消收藏' : '收藏'}
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => setInterviewJob(active)}
                >
                  面试准备
                </button>
                <button type="button" className="btn" onClick={() => generatePitchForJob(active.id)}>
                  生成话术
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!active.pitch}
                  onClick={async () => {
                    if (!active.pitch) return
                    await copyText(active.pitch)
                    pushToast('success', '话术已复制')
                  }}
                >
                  复制话术
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => exportPackageForJob(active.id)}
                >
                  导出材料包
                </button>
                {active.link && (
                  <a
                    href={active.link}
                    target={settings.search.openLinksInNewTab ? '_blank' : undefined}
                    rel="noreferrer"
                    className="btn"
                  >
                    打开来源
                    <IconExternal className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-400">选择岗位            </div>
          )}
        </section>
      </div>
      {interviewJob && (
        <InterviewModal
          job={interviewJob}
          resume={resume}
          onClose={() => setInterviewJob(null)}
        />
      )}
      {showAddJob && <AddJobModal onClose={() => setShowAddJob(false)} />}
    </div>
  )
}

function statusLabel(s?: string) {
  const map: Record<string, string> = {
    new: '新',
    saved: '收藏',
    applied: '已投',
    interviewing: '面试',
    offer: 'Offer',
    rejected: '淘汰',
    archived: '归档',
  }
  return map[s || 'new'] || s || '新'
}
