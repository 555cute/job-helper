/** 全局禁止非输入区域文本选择（修复 Electron 选中文字消失） */
export function installDisableSelect() {
  const isEditable = (el: EventTarget | null) => {
    if (!(el instanceof HTMLElement)) return false
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true
    if (el.isContentEditable) return true
    if (el.closest('.allow-select')) return true
    return false
  }

  const onSelectStart = (e: Event) => {
    if (!isEditable(e.target)) {
      e.preventDefault()
      return false
    }
  }

  const onMouseDown = (e: MouseEvent) => {
    if (!isEditable(e.target)) {
      // 清掉已有选区，避免残留“透明选中”
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        sel.removeAllRanges()
      }
    }
  }

  document.addEventListener('selectstart', onSelectStart, true)
  document.addEventListener('mousedown', onMouseDown, true)

  return () => {
    document.removeEventListener('selectstart', onSelectStart, true)
    document.removeEventListener('mousedown', onMouseDown, true)
  }
}
