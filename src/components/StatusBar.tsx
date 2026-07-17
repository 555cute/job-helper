import { useApp } from '../state/AppContext'

export function StatusBar() {
  const { settings, stats, jobs, backendOnline } = useApp()

  return (
    <footer
      className="app-status"
      onMouseDown={(e) => e.preventDefault()}
      onSelect={(e) => e.preventDefault()}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        height: 32,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid #f3f4f6',
        background: '#fafafa',
        padding: '0 20px',
        fontSize: 11,
        color: '#4b5563',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: backendOnline ? '#10b981' : '#f87171',
              display: 'inline-block',
            }}
          />
          后端 {backendOnline ? '在线' : '离线'}
        </span>
        <span style={{ color: '#d1d5db' }}>|</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: settings.agent.enabled ? '#10b981' : '#d1d5db',
              display: 'inline-block',
            }}
          />
          Agent {settings.agent.enabled ? '就绪' : '关闭'}
        </span>
        <span style={{ color: '#d1d5db' }}>|</span>
        <span>
          {settings.agent.model}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, color: '#6b7280' }}>
        <span>岗位 {jobs.length}</span>
        <span>高匹配 {stats.highMatchCount}</span>
        <span>任务 {stats.runningTasks}</span>
      </div>
    </footer>
  )
}
