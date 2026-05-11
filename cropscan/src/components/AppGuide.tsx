import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../context/useAuth'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AppGuide({ open, onOpenChange }: Props) {
  const { isAuthenticated } = useAuth()

  if (!open) return null

  const steps = isAuthenticated
    ? [
        ['Start with Today', 'Open CropScan to see which growing spot needs attention first.'],
        ['Scan only changed leaves', 'Use a clear photo when color, spots, curling, or wilting changed.'],
        ['Save to a spot', 'CropScan can connect scans to the bed, row, or plot where they happened.'],
        ['Review history', 'Use saved notes to track what improved, stayed the same, or got worse.'],
      ]
    : [
        ['Create an account', 'Your scans and growing spots stay tied to your login.'],
        ['Add one spot', 'Use current location so the app can give weather-aware guidance.'],
        ['Scan one leaf', 'Start with one clear photo before trying advanced options.'],
      ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forest-900/40 px-4 pb-6 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-guide-title"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-stroke bg-surface p-5 text-forest-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-leaf-500">
              Field guide
            </p>
            <h2 id="app-guide-title" className="mt-1 font-display text-xl font-bold">
              What to do next
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="crop-touch flex items-center justify-center rounded-md bg-surface-2 text-forest-700 transition hover:bg-canvas"
            aria-label="Close guide"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <ol className="mt-5 grid gap-4">
          {steps.map(([title, body], index) => (
            <li key={title} className="grid grid-cols-[36px_1fr] gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-forest-700 text-sm font-black text-lime">
                {index + 1}
              </span>
              <span>
                <span className="block text-sm font-bold">{title}</span>
                <span className="mt-1 block text-sm leading-5 text-muted">
                  {body}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            to={isAuthenticated ? '/scan' : '/signup'}
            onClick={() => onOpenChange(false)}
            className="crop-touch flex flex-1 items-center justify-center rounded-md bg-lime px-4 text-sm font-bold text-forest-700 transition hover:bg-lime-soft"
          >
            {isAuthenticated ? 'Scan a leaf' : 'Create account'}
          </Link>
          {isAuthenticated ? (
            <Link
              to="/plots"
              onClick={() => onOpenChange(false)}
              className="crop-touch flex flex-1 items-center justify-center rounded-md bg-surface-2 px-4 text-sm font-bold text-forest-700 ring-1 ring-stroke transition hover:bg-canvas"
            >
              Add a plot
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default AppGuide
