import type { CSSProperties } from 'react'
import { useApp } from '../state/AppContext'

export function TitleBar() {
  const { settings } = useApp()
  const drag = { WebkitAppRegion: 'drag' } as CSSProperties
  const noDrag = { WebkitAppRegion: 'no-drag' } as CSSProperties

  return (
    <div
      className="flex h-10 shrink-0 select-none items-center justify-between border-b border-gray-100 bg-white px-4"
      style={drag}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5" style={noDrag}>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 text-[10px] font-bold text-white">
            {settings.general.appName.slice(0, 1) || '求'}
          </div>
          <span className="text-[12.5px] font-semibold text-gray-900">
            {settings.general.appName}
          </span>
        </div>
      </div>
      <div className="text-[11px] text-gray-400">Desktop</div>
    </div>
  )
}
