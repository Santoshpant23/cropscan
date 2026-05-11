import { Link } from 'react-router-dom'
import { ArrowLeft, Home, Sprout } from 'lucide-react'
import { useAuth } from '../context/useAuth'

function NotFound() {
  const { isAuthenticated } = useAuth()

  return (
    <section className="mx-auto grid w-full max-w-md place-items-center px-6 pb-12 pt-12 lg:max-w-3xl lg:pt-20">
      <div className="w-full rounded-lg border border-stroke bg-surface p-8 text-center shadow-sm sm:p-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-leaf-300/30 text-leaf-700">
          <Sprout className="h-8 w-8" strokeWidth={2} />
        </span>
        <p className="font-display mt-7 text-7xl font-bold tracking-tight text-forest-900 sm:text-8xl">
          404
        </p>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-forest-900 sm:text-3xl">
          This page took a wrong turn at the field.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          The coordinates you entered don't seem to match any active scan areas in
          our records.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="crop-touch inline-flex items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-lime-soft"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
            Back to today
          </Link>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="crop-touch inline-flex items-center justify-center gap-2 rounded-md border border-stroke bg-white px-6 text-base font-bold text-forest-900 transition hover:border-leaf-700 hover:bg-canvas"
            >
              <Home className="h-5 w-5" strokeWidth={2.2} />
              Go to dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="crop-touch inline-flex items-center justify-center gap-2 rounded-md border border-stroke bg-white px-6 text-base font-bold text-forest-900 transition hover:border-leaf-700 hover:bg-canvas"
            >
              <Home className="h-5 w-5" strokeWidth={2.2} />
              Login to scan
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

export default NotFound
