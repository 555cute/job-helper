import { useMemo } from 'react'
import type { JobPost, ResumeSection } from '../types'
import { buildInterviewPrep, exportInterviewPrep, PLATFORM_RULES } from '../lib/platform'
import { copyText } from '../lib/export'

type Props = {
  job: JobPost
  resume: ResumeSection[]
  onClose: () => void
}

export function InterviewModal({ job, resume, onClose }: Props) {
  const prep = useMemo(() => buildInterviewPrep(job, resume), [job, resume])
  const rules = PLATFORM_RULES[job.source] || PLATFORM_RULES.boss

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 max-h-[92vh] w-full max-w-[720px] overflow-auto rounded-2xl border border-gray-100 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <div className="text-[15px] font-semibold text-gray-900">
              面试准备 · {job.title}
            </div>
            <div className="text-[12px] text-gray-400">
              {job.company} · {rules.label} 优化
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn text-[12px]"
              onClick={() => {
                const fname = exportInterviewPrep(prep)
                copyText(`已导出：${fname}`)
              }}
            >
              导出 MD
            </button>
            <button type="button" onClick={onClose} className="btn text-[12px]">
              关闭
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl bg-gray-50 p-4 text-[13px] leading-6 text-gray-600">
            <div className="mb-2 font-semibold text-gray-800">平台提示</div>
            {prep.platformNotes}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                风格：{rules.toneHint}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                长度：{rules.lengthHint}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-semibold text-gray-800">简历亮点</div>
            <div className="space-y-1 rounded-xl border border-gray-100 bg-gray-50 p-3 text-[12.5px] leading-6 text-gray-600">
              {prep.resumeHighlights.map((h) => (
                <div key={h}>{h}</div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-semibold text-gray-800">模拟问答</div>
            <div className="space-y-3">
              {prep.questions.map((q) => (
                <details
                  key={q.id}
                  className="group rounded-xl border border-gray-100 bg-white p-3 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="cursor-pointer text-[13px] font-semibold text-gray-800">
                    <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                      {q.category}
                    </span>
                    {q.question}
                  </summary>
                  <div className="mt-3 space-y-2 border-t border-gray-50 pt-3">
                    <div className="text-[12px] font-medium text-indigo-600">
                      回答要点：{q.hint}
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3 text-[12.5px] leading-6 text-gray-700">
                      {q.sampleAnswer}
                    </div>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-indigo-600"
                      onClick={async () => {
                        await copyText(q.sampleAnswer)
                      }}
                    >
                      复制回答
                    </button>
                  </div>
                </details>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[13px] font-semibold text-gray-800">面后 Tips</div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-[12.5px] leading-6 text-gray-600">
              {prep.closingTips.map((t) => (
                <div key={t}>· {t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
