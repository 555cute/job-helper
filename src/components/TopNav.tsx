import {
  IconBot,
  IconDoc,
  IconDownload,
  IconGrid,
  IconList,
  IconPlay,
  IconSearch,
  IconSettings,
  IconSpark,
  IconUpload,
} from './Icons'
import { useApp } from '../state/AppContext'
import { isDesktopApp } from '../lib/desktop'
import type { NavKey } from '../types'

const LOGO_URL = './logo-v2.png'

const tabs: { key: NavKey; label: string; Icon: typeof IconGrid }[] = [
  { key: 'workbench', label: '工作台', Icon: IconGrid },
  { key: 'agent', label: 'Agent', Icon: IconBot },
  { key: 'resume', label: '简历', Icon: IconDoc },
  { key: 'pipeline', label: 'Pipeline', Icon: IconList },
  { key: 'interview', label: '面试', Icon: IconSpark },
  { key: 'search', label: '检索', Icon: IconSearch },
  { key: 'settings', label: '设置', Icon: IconSettings },
]

export function TopNav() {
  const {
    nav,
    setNav,
    setSeedPrompt,
    runExport,
    importResumeText,
    pushToast,
    settings,
    stats,
    setResume,
  } = useApp()

  const desktop = isDesktopApp()

  function runAgent() {
    setSeedPrompt('按当前简历检索高匹配岗位并给出改简历建议')
    setNav('agent')
  }

  function onImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf,.docx,.md,.txt,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'pdf' || ext === 'docx' || ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp' || ext === 'mp4' || ext === 'mov') {
        try {
          const buf = await file.arrayBuffer()
          const bytes = new Uint8Array(buf)
          let base64 = ''
          for (let i = 0; i < bytes.length; i += 8192) {
            base64 += String.fromCharCode(...bytes.slice(i, i + 8192))
          }
          base64 = btoa(base64)
          const { api } = await import('../lib/api')
          const data = await api.parseResumeFile(base64, file.name, settings)
          if (data.sections?.length) {
            setResume(data.sections)
            pushToast('success', `已解析 ${data.sections.length} 段`)
          }
        } catch (err) {
          pushToast('error', err instanceof Error ? err.message : '导入失败')
        }
      } else {
        importResumeText(await file.text())
      }
    }
    input.click()
  }

  return (
    <div
      className={`flex shrink-0 items-stretch border-b border-gray-100 bg-white ${desktop ? 'app-drag' : ''}`}
      style={{ height: desktop ? 48 : 52, paddingRight: desktop ? 140 : 16 }}
    >
      <div className={`flex shrink-0 items-center gap-2.5 px-4 ${desktop ? 'app-drag' : ''}`}>
        <img src={LOGO_URL} alt={settings.general.appName} width={32} height={32} className="h-8 w-8 rounded-xl object-contain shadow-sm shadow-indigo-600/10" draggable={false} />
        <div className="hidden min-w-0 leading-tight sm:block">
          <div className="truncate text-[13px] font-semibold tracking-tight text-gray-900">{settings.general.appName}</div>
          <div className="text-[10px] text-gray-400">Job Helper</div>
        </div>
      </div>
      <div className="my-3 w-px shrink-0 bg-gray-200" />
      <div className={`flex shrink-0 items-center gap-1 px-3 ${desktop ? 'app-no-drag' : ''}`}>
        {tabs.map(({ key, label, Icon }) => {
          const on = nav === key
          return (
            <button key={key} type="button" onClick={() => setNav(key)} className={`tab ${on ? 'active' : ''}`}>
              <Icon className="h-4 w-4" />
              {label}
              {key === 'pipeline' && stats.appliedCount > 0 && (
                <span className="ml-0.5 rounded-full bg-indigo-100 px-1.5 text-[10px] font-semibold text-indigo-700">{stats.appliedCount}</span>
              )}
            </button>
          )
        })}
      </div>
      <div className={`min-w-[48px] flex-1 ${desktop ? 'app-drag' : ''}`} />
      <div className={`flex shrink-0 items-center gap-2 px-3 ${desktop ? 'app-no-drag' : ''}`}>
        <span className="hidden select-none rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 lg:inline">完善度 {stats.resumeScore}%</span>
        <button type="button" onClick={onImport} className="btn"><IconUpload className="h-4 w-4" />导入</button>
        <button type="button" onClick={() => { void runExport(settings.export.includeResume ? 'all' : 'jobs'); pushToast('info', '开始导出…') }} className="btn"><IconDownload className="h-4 w-4" />导出</button>
        <button type="button" onClick={runAgent} className="btn btn-primary"><IconPlay className="h-3.5 w-3.5" />运行 Agent</button>
      </div>
    </div>
  )
}
