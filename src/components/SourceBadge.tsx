import { sourceMeta } from '../data/defaults'
import type { SourceKey } from '../types'

export function SourceBadge({ source }: { source: SourceKey }) {
  const meta = sourceMeta[source]
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"
      style={{ background: meta.color }}
    >
      {meta.short}
    </span>
  )
}
