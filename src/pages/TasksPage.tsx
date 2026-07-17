import { useApp } from '../state/AppContext'

export function TasksPage() {
  const { tasks, cancelTask, clearTasks, settings } = useApp()

  return (
    <div className="flex h-full flex-col gap-4 bg-white px-6 py-5">
      <div className="card flex items-center justify-between px-4 py-3">
        <div className="text-[12.5px] text-gray-400">
          并发 {settings.tasks.maxConcurrent} · 历史 {settings.tasks.keepHistory} · 重试{' '}
          {settings.tasks.autoRetry ? settings.tasks.retryTimes : 0}
        </div>
        <button type="button" onClick={clearTasks} className="btn h-8">
          清空记录
        </button>
      </div>

      <div className="card min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="sticky top-0 bg-gray-50 text-[11px] text-gray-400">
            <tr>
              <th className="px-4 py-3 font-medium">任务</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">进度</th>
              <th className="px-4 py-3 font-medium">说明</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{t.name}</div>
                  <div className="text-[11px] text-gray-400">{t.createdAt}</div>
                </td>
                <td className="px-4 py-3 text-gray-500">{typeLabel(t.type)}</td>
                <td className="px-4 py-3">
                  <Status status={t.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${t.progress}%` }} />
                    </div>
                    <span className="text-[12px] text-gray-500">{t.progress}%</span>
                  </div>
                </td>
                <td className="max-w-[240px] truncate px-4 py-3 text-gray-500" title={t.summary}>
                  {t.summary}
                </td>
                <td className="px-4 py-3">
                  {(t.status === 'queued' || t.status === 'running') && (
                    <button type="button" onClick={() => cancelTask(t.id)} className="text-[12px] font-semibold text-red-500">
                      取消
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-gray-400">
                  暂无任务
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    resume: '改简历',
    search: '检索',
    match: '匹配',
    export: '导出',
    agent: 'Agent',
  }
  return map[t] || t
}

function Status({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: 'bg-emerald-50 text-emerald-600',
    running: 'bg-indigo-50 text-indigo-600',
    queued: 'bg-gray-100 text-gray-500',
    failed: 'bg-red-50 text-red-600',
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
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[status] || ''}`}>
      {label[status] || status}
    </span>
  )
}
