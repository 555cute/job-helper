import { useState } from 'react'
import { IconBot, IconDoc, IconList, IconSearch } from '../components/Icons'
import { useApp } from '../state/AppContext'
import { copyText, exportMatchReport } from '../lib/export'
import type { JdAnalysis } from '../types'

export function WorkbenchPage() {
  const {
    jobs,
    tasks,
    stats,
    setNav,
    runSearch,
    runOptimizeResume,
    settings,
    analyzeJd,
    applyJdToResume,
    saveJdAsJob,
    lastJdAnalysis,
    pushToast,
  } = useApp()

  const [jdText, setJdText] = useState('')
  const [busy, setBusy] = useState(false)
  const [analysis, setAnalysis] = useState<JdAnalysis | null>(lastJdAnalysis)

  const pipeline = {
    saved: jobs.filter((j) => j.starred || j.applyStatus === 'saved').length,
    applied: jobs.filter((j) => j.applyStatus === 'applied').length,
    interviewing: jobs.filter((j) => j.applyStatus === 'interviewing').length,
  }

  async function onAnalyze() {
    setBusy(true)
    try {
      const a = await analyzeJd(jdText)
      setAnalysis(a)
      pushToast('success', `匹配 ${a.match} 分`)
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-white px-6 py-5">
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: '简历完善度', value: `${stats.resumeScore}%` },
          { label: '高匹配岗位', value: String(stats.highMatchCount) },
          { label: '收藏', value: String(stats.starredCount) },
          { label: '已投/面试', value: String(stats.appliedCount) },
        ].map((c) => (
          <div key={c.label} className="card px-4 py-3.5">
            <div className="text-[12px] text-gray-400">{c.label}</div>
            <div className="mt-1 text-[26px] font-semibold tracking-tight text-gray-900">{c.value}</div>
          </div>
        ))}
      </div>

      {/* 粘贴 JD 核心流 */}
      <section className="card mb-4 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-50 px-4 py-3">
          <div>
            <div className="text-[13px] font-semibold text-gray-900">粘贴 JD → 匹配 → 改简历</div>
            <div className="text-[12px] text-gray-400">从 Boss/智联复制职位描述，一键分析短板并优化</div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !jdText.trim()}
              onClick={() => void onAnalyze()}
              className="btn btn-primary disabled:opacity-50"
            >
              {busy ? '分析中…' : '分析 JD'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-0">
          <div className="border-r border-gray-50 p-4">
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder={'粘贴完整职位描述，例如：\n岗位职责：...\n任职要求：熟悉 React / TypeScript ...'}
              className="field allow-select min-h-[200px] resize-y"
            />
            <div className="mt-2 text-[11px] text-gray-400">
              目标：{settings.resume.targetRole} · {settings.resume.targetCities} · {settings.resume.targetSalary}
            </div>
          </div>
          <div className="max-h-[280px] overflow-auto p-4">
            {!analysis ? (
              <div className="flex h-full min-h-[180px] items-center justify-center text-[13px] text-gray-400">
                分析结果会显示在这里
              </div>
            ) : (
              <div className="space-y-3 text-[13px]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[15px] font-semibold text-gray-900">{analysis.title}</div>
                    <div className="text-[12px] text-gray-500">
                      {analysis.company} · {analysis.city} · {analysis.salary}
                    </div>
                  </div>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[13px] font-semibold text-emerald-700">
                    匹配 {analysis.match}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.tags.slice(0, 8).map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
                <div>
                  <div className="mb-1 text-[12px] font-semibold text-gray-500">短板</div>
                  <ul className="space-y-1 text-[12.5px] text-gray-700">
                    {analysis.gaps.map((g) => (
                      <li key={g}>· {g}</li>
                    ))}
                  </ul>
                </div>
                {analysis.missingKeywords.length > 0 && (
                  <div className="text-[12.5px] text-gray-600">
                    <span className="font-semibold text-gray-500">建议关键词：</span>
                    {analysis.missingKeywords.join('、')}
                  </div>
                )}
                <div className="rounded-xl bg-gray-50 p-3 text-[12.5px] leading-6 text-gray-700">
                  {analysis.pitch}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => applyJdToResume(analysis)} className="btn btn-primary">
                    应用到简历
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const id = saveJdAsJob(analysis, jdText)
                      setNav('search')
                      pushToast('info', `已保存岗位 ${id.slice(0, 8)}…`)
                    }}
                    className="btn"
                  >
                    保存为岗位
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await copyText(analysis.pitch)
                      pushToast('success', '话术已复制')
                    }}
                    className="btn"
                  >
                    复制话术
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const name = exportMatchReport(analysis.reportMarkdown, settings)
                      pushToast('success', `报告已导出：${name}`)
                    }}
                    className="btn"
                  >
                    导出报告
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[1.15fr_0.85fr] gap-4">
        <section className="card overflow-hidden">
          <div className="border-b border-gray-50 px-4 py-3 text-[13px] font-semibold text-gray-900">
            快捷入口
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {[
              { title: '优化简历', desc: settings.resume.targetRole, Icon: IconDoc, go: () => void runOptimizeResume() },
              {
                title: '检索岗位',
                desc: `${settings.search.defaultCity} · ${settings.search.defaultKeyword}`,
                Icon: IconSearch,
                go: () => void runSearch(),
              },
              {
                title: '打开 Agent',
                desc: settings.agent.enabled ? settings.agent.model : '已关闭',
                Icon: IconBot,
                go: () => setNav('agent'),
              },
              {
                title: '跟进管道',
                desc: `收藏 ${pipeline.saved} · 已投 ${pipeline.applied} · 面试 ${pipeline.interviewing}`,
                Icon: IconList,
                go: () => setNav('search'),
              },
            ].map((a) => (
              <button
                key={a.title}
                type="button"
                onClick={a.go}
                className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-left transition hover:border-indigo-100 hover:bg-indigo-50/40"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-gray-100">
                  <a.Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="text-[14px] font-semibold text-gray-900">{a.title}</div>
                <div className="mt-1 truncate text-[12px] text-gray-400">{a.desc}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-50 px-4 py-3">
            <div className="text-[13px] font-semibold text-gray-900">最近任务</div>
            <button type="button" onClick={() => setNav('pipeline')} className="text-[12px] font-medium text-indigo-600">
              全部
            </button>
          </div>
          <div className="max-h-[300px] space-y-2 overflow-auto p-3">
            {tasks.slice(0, 6).map((t) => (
              <div key={t.id} className="rounded-xl border border-gray-100 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] font-medium text-gray-800">{t.name}</p>
                  <Status status={t.status} />
                </div>
                <p className="mt-1 truncate text-[12px] text-gray-400">{t.summary}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${t.progress}%` }} />
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="py-12 text-center text-[13px] text-gray-400">暂无任务</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Status({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: 'bg-emerald-50 text-emerald-600',
    running: 'bg-indigo-50 text-indigo-600',
    queued: 'bg-gray-100 text-gray-500',
    failed: 'bg-red-50 text-red-500',
    cancelled: 'bg-gray-100 text-gray-400',
  }
  const label: Record<string, string> = {
    done: '完成',
    running: '运行中',
    queued: '排队',
    failed: '失败',
    cancelled: '取消',
  }
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[status] || ''}`}>
      {label[status] || status}
    </span>
  )
}
