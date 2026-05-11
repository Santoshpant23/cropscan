import { NavLink } from 'react-router-dom'
import {
  Footprints,
  Layers,
  LayoutDashboard,
  ScanLine,
  User,
} from 'lucide-react'

type Tab = {
  to: string
  end?: boolean
  label: string
  Icon: typeof LayoutDashboard
}

const tabs: Tab[] = [
  { to: '/', end: true, label: 'Today', Icon: LayoutDashboard },
  { to: '/scan', label: 'Scan', Icon: ScanLine },
  { to: '/walk', label: 'Walk', Icon: Footprints },
  { to: '/plots', label: 'Plots', Icon: Layers },
  { to: '/profile', label: 'Profile', Icon: User },
]

function BottomNav() {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-stroke bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {tabs.map(({ to, end, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  'crop-touch flex flex-col items-center justify-center gap-1 rounded-md px-1 py-2 text-[11px] font-bold transition',
                  isActive
                    ? 'text-forest-700'
                    : 'text-muted hover:text-forest-700',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    key={isActive ? 'active' : 'idle'}
                    className={[
                      'flex h-9 w-9 items-center justify-center rounded-full transition',
                      isActive ? 'bg-lime text-forest-700 crop-tab-pop' : 'text-current',
                    ].join(' ')}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default BottomNav
