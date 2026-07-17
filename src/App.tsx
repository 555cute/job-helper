import { useEffect, useState } from 'react'
import { TopNav } from './components/TopNav'
import { StatusBar } from './components/StatusBar'
import { Toast } from './components/Toast'
import { Onboarding } from './components/Onboarding'
import { AppProvider, useApp } from './state/AppContext'
import { WorkbenchPage } from './pages/WorkbenchPage'
import { AgentPage } from './pages/AgentPage'
import { ResumePage } from './pages/ResumePage'
import { PipelinePage } from './pages/PipelinePage'
import { SearchPage } from './pages/SearchPage'
import { InterviewPage } from './pages/InterviewPage'
import { SettingsPage } from './pages/SettingsPage'
import { isDesktopApp } from './lib/desktop'

function Shell() {
  const { nav, hasResume, setNav } = useApp()
  const [skipped, setSkipped] = useState(false)
  const desktop = isDesktopApp()
  const showOnboarding = !hasResume && !skipped

  useEffect(() => {
    document.documentElement.classList.toggle('is-desktop', desktop)
    document.body.classList.toggle('is-desktop', desktop)
  }, [desktop])

  if (showOnboarding) {
    return (
      <div className={`app-shell ${desktop ? 'app-shell-desktop' : 'app-shell-web'}`}>
        <Onboarding onDone={() => setNav('workbench')} onSkip={() => setSkipped(true)} />
        <Toast />
      </div>
    )
  }

  return (
    <div className={`app-shell ${desktop ? 'app-shell-desktop' : 'app-shell-web'}`}>
      <TopNav />
      <main className="app-main">
        {nav === 'workbench' && <WorkbenchPage />}
        {nav === 'agent' && <AgentPage />}
        {nav === 'resume' && <ResumePage />}
        {nav === 'pipeline' && <PipelinePage />}
        {nav === 'search' && <SearchPage />}
        {nav === 'interview' && <InterviewPage />}
        {nav === 'settings' && <SettingsPage />}
      </main>
      <StatusBar />
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
