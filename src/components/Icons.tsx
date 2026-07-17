type P = { className?: string }

export const IconGrid = ({ className = 'w-5 h-5' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)

export const IconBot = ({ className = 'w-5 h-5' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="5" y="8" width="14" height="11" rx="3" />
    <path d="M12 8V5M9 13h.01M15 13h.01M9 16.5h6" strokeLinecap="round" />
    <circle cx="12" cy="4.5" r="1" fill="currentColor" stroke="none" />
  </svg>
)

export const IconDoc = ({ className = 'w-5 h-5' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" strokeLinecap="round" />
  </svg>
)

export const IconSearch = ({ className = 'w-5 h-5' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" strokeLinecap="round" />
  </svg>
)

export const IconList = ({ className = 'w-5 h-5' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" strokeLinecap="round" />
  </svg>
)

export const IconSettings = ({ className = 'w-5 h-5' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" strokeLinecap="round" />
  </svg>
)

export const IconPlay = ({ className = 'w-4 h-4' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </svg>
)

export const IconSend = ({ className = 'w-4 h-4' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 12 20 4l-5 16-3-6-8-2Z" strokeLinejoin="round" />
  </svg>
)

export const IconSpark = ({ className = 'w-4 h-4' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l1.2 6.2L19 9l-5.2 2.2L12 17l-1.8-5.8L5 9l5.8-.8L12 2Z" />
  </svg>
)

export const IconDownload = ({ className = 'w-4 h-4' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconUpload = ({ className = 'w-4 h-4' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 16V6m0 0 4 4m-4-4-4 4M5 18h14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const IconExternal = ({ className = 'w-4 h-4' }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 5h5v5M19 5l-8 8M10 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
