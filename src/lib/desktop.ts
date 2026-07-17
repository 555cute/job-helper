export function isDesktopApp() {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { jobHelperDesktop?: { isDesktop?: boolean } }
  return !!w.jobHelperDesktop?.isDesktop
}
