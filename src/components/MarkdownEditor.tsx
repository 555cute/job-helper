import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'

export function MarkdownEditor({
  value,
  onChange,
  className = '',
  placeholder = '',
  minHeight = 400,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  minHeight?: number
}) {
  const [tab, setTab] = useState<'edit' | 'preview' | 'split'>('split')
  const [preview, setPreview] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const html = marked.parse(value || '', { breaks: true, gfm: true })
    setPreview(html as string)
  }, [value])

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div className="flex items-center gap-1 border-b border-gray-100 px-3 py-1.5 text-[12px]">
        {(['edit', 'split', 'preview'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded px-2 py-1 ${tab === t ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            {t === 'edit' ? '编辑' : t === 'split' ? '分屏' : '预览'}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-gray-300">支持 Markdown 格式</span>
      </div>

      <div className="min-h-0 flex-1 flex" style={{ minHeight }}>
        {(tab === 'edit' || tab === 'split') && (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`allow-select min-h-0 w-full resize-none bg-transparent p-5 text-[13px] leading-7 text-gray-800 outline-none ${
              tab === 'split' ? 'border-r border-gray-100' : ''
            }`}
          />
        )}
        {(tab === 'preview' || tab === 'split') && (
          <div
            ref={previewRef}
            className="allow-select markdown-body min-h-0 w-full overflow-auto p-5 text-[13px] leading-7 text-gray-700"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        )}
      </div>
    </div>
  )
}
