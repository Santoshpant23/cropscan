import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-[#bef264] text-[#16351f]'
      : 'text-[#4b5d50] hover:bg-white hover:text-[#16351f]',
  ].join(' ')

function NavBar() {
  const { isAuthenticated, logout, user } = useAuth()

  return (
    <header className="sticky top-0 z-30 border-b border-[#14532d]/10 bg-[#f4fbf7]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#16351f] text-lg font-black text-[#bef264] sm:h-10 sm:w-10">
            C
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black text-[#16351f]">
              CropScan
            </span>
            <span className="hidden truncate text-xs font-medium text-[#4b5d50] sm:block">
              {isAuthenticated ? user?.role : 'Leaf diagnosis for field visits'}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {isAuthenticated ? (
            <>
              <NavLink to="/scan" className={navLinkClass}>
                Scan
              </NavLink>
              <NavLink to="/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink
                to="/profile"
                className={(props) => `${navLinkClass(props)} hidden sm:inline-flex`}
              >
                Profile
              </NavLink>
            </>
          ) : (
            <>
              <NavLink
                to="/"
                end
                className={(props) => `${navLinkClass(props)} hidden sm:inline-flex`}
              >
                Home
              </NavLink>
              <NavLink to="/login" className={navLinkClass}>
                Login
              </NavLink>
            </>
          )}
        </div>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={logout}
            className="cursor-pointer rounded-md bg-[#16351f] px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#166534] sm:px-4"
          >
            Logout
          </button>
        ) : (
          <Link
            to="/signup"
            className="rounded-md bg-[#16351f] px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#166534] sm:px-4"
          >
            Sign up
          </Link>
        )}
      </nav>
    </header>
  )
}

export default NavBar
