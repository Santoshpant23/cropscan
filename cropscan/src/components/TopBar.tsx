import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, HelpCircle, LogOut } from 'lucide-react'
import { useAuth } from '../context/useAuth'

const TITLES: Record<string, string> = {
  '/scan': 'Scan a leaf',
  '/walk': 'Walk a row',
  '/dashboard': 'Scan history',
  '/plots': 'Plots',
  '/plots/:plotId': 'Plot care',
  '/profile': 'Profile',
  '/login': 'Log in',
  '/signup': 'Create account',
  '/forgot-password': 'Reset password',
  '/supported-plants': 'Supported plants',
}

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex items-center rounded-md px-3 py-2 text-sm font-bold transition',
    isActive
      ? 'bg-lime text-forest-700'
      : 'text-muted hover:bg-surface hover:text-forest-700',
  ].join(' ')

type Props = {
  onOpenGuide?: () => void
}

function TopBar({ onOpenGuide }: Props) {
  const { isAuthenticated, logout, user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const isHome = location.pathname === '/'
  const title =
    TITLES[location.pathname] ??
    (location.pathname.startsWith('/plots/') ? 'Plot care' : undefined)
  const showMobileBack = !isHome

  return (
    <header className="sticky top-0 z-30 border-b border-stroke bg-canvas/90 backdrop-blur">
      {/* Mobile bar */}
      <div
        className="flex items-center justify-between gap-2 px-4 lg:hidden"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: '8px' }}
      >
        {showMobileBack ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="crop-touch -ml-2 flex items-center justify-center rounded-md text-forest-700 transition hover:bg-surface"
            aria-label="Back"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </button>
        ) : (
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-forest-700 text-base font-black text-lime">
              C
            </span>
            <span className="font-display text-base font-bold text-forest-700">
              CropScan
            </span>
          </Link>
        )}

        <span className="truncate text-sm font-bold text-forest-700">
          {title ?? ''}
        </span>

        <div className="flex items-center gap-1">
          {onOpenGuide ? (
            <button
              type="button"
              onClick={onOpenGuide}
              className="crop-touch flex items-center justify-center rounded-md text-muted transition hover:text-forest-700"
              aria-label="Open guide"
            >
              <HelpCircle size={22} strokeWidth={2} />
            </button>
          ) : null}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={logout}
              className="crop-touch flex items-center gap-1 rounded-md px-2 text-xs font-bold text-muted transition hover:text-forest-700"
              aria-label="Sign out"
            >
              <LogOut size={20} strokeWidth={2} />
              <span>Sign out</span>
            </button>
          ) : null}
          {!isAuthenticated && location.pathname !== '/login' ? (
            <Link
              to="/login"
              className="rounded-md bg-forest-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-forest-500"
            >
              Log in
            </Link>
          ) : null}
        </div>
      </div>

      {/* Desktop bar */}
      <nav className="mx-auto hidden max-w-7xl items-center justify-between gap-3 px-6 py-4 lg:flex lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-forest-700 text-lg font-black text-lime">
            C
          </span>
          <span>
            <span className="block font-display text-base font-bold text-forest-700">
              CropScan
            </span>
            <span className="block text-xs font-medium text-muted">
              {isAuthenticated
                ? user?.role ?? 'Field Agronomist'
                : 'Leaf diagnosis for field visits'}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {isAuthenticated ? (
            <>
              <NavLink to="/" end className={desktopLinkClass}>
                Today
              </NavLink>
              <NavLink to="/scan" className={desktopLinkClass}>
                Scan
              </NavLink>
              <NavLink to="/walk" className={desktopLinkClass}>
                Walk
              </NavLink>
              <NavLink to="/dashboard" className={desktopLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/plots" className={desktopLinkClass}>
                Plots
              </NavLink>
              <NavLink to="/supported-plants" className={desktopLinkClass}>
                Plants
              </NavLink>
              <NavLink to="/profile" className={desktopLinkClass}>
                Profile
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/" end className={desktopLinkClass}>
                Home
              </NavLink>
              <NavLink to="/login" className={desktopLinkClass}>
                Log in
              </NavLink>
              <NavLink to="/supported-plants" className={desktopLinkClass}>
                Plants
              </NavLink>
            </>
          )}
        </div>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={logout}
            className="rounded-md bg-forest-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-forest-500"
          >
            Sign out
          </button>
        ) : (
          <Link
            to="/signup"
            className="rounded-md bg-lime px-4 py-2 text-sm font-bold text-forest-700 transition hover:bg-lime-soft"
          >
            Create account
          </Link>
        )}
      </nav>
    </header>
  )
}

export default TopBar
