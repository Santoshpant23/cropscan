import { Link } from 'react-router-dom'
import { ArrowRight, Leaf, ScanSearch } from 'lucide-react'

function Footer() {
  return (
    <footer className="border-t border-stroke bg-surface">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-8">
        <div>
          <p className="font-display text-lg font-bold tracking-tight text-forest-900">
            CropScan supports 14 plant groups and 38 model classes.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Check supported crops before scanning random leaves, then use a clear
            close-up photo for the strongest result.
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-leaf-700">
            CS434 Neural AI capstone
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/supported-plants"
            className="crop-touch inline-flex items-center justify-center gap-2 rounded-md border border-stroke bg-surface-2 px-5 text-sm font-bold text-forest-700 transition hover:bg-canvas"
          >
            <Leaf className="h-4 w-4" strokeWidth={2.4} />
            What plants?
          </Link>
          <Link
            to="/signup"
            className="crop-touch inline-flex items-center justify-center gap-2 rounded-md bg-lime px-5 text-sm font-bold text-forest-900 shadow-sm transition hover:bg-lime-soft"
          >
            <ScanSearch className="h-4 w-4" strokeWidth={2.4} />
            Start scanning
            <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default Footer
