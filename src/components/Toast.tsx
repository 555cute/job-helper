import { useApp } from '../state/AppContext'

export function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  const color =
    toast.type === 'success'
      ? 'border-emerald-100 text-emerald-700'
      : toast.type === 'error'
        ? 'border-red-100 text-red-600'
        : 'border-indigo-100 text-indigo-700'
  return (
    <div className="pointer-events-none fixed bottom-10 right-8 z-50">
      <div className={`rounded-xl border bg-white px-4 py-2.5 text-[13px] font-medium shadow-lg ${color}`}>
        {toast.text}
      </div>
    </div>
  )
}
