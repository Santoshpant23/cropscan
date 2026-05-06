import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import AppGuide from './AppGuide'
import BottomNav from './BottomNav'
import Footer from './Footer'
import TopBar from './TopBar'

function AppShell({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const [guideOpen, setGuideOpen] = useState(false)

  const isPublicLanding = !isAuthenticated && location.pathname === '/'
  const showBottomNav = isAuthenticated
  const showFooter = isPublicLanding

  return (
    <div className="min-h-screen bg-canvas text-forest-700">
      <TopBar onOpenGuide={() => setGuideOpen(true)} />
      <main
        className={
          showBottomNav
            ? 'pb-[calc(env(safe-area-inset-bottom)+88px)] lg:pb-0'
            : undefined
        }
      >
        {children}
      </main>
      {showFooter ? <Footer /> : null}
      {showBottomNav ? <BottomNav /> : null}
      <AppGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  )
}

export default AppShell
