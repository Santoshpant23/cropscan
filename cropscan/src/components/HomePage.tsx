import { Link } from 'react-router-dom'

const supportedCrops = [
  'Tomato',
  'Potato',
  'Corn',
  'Apple',
  'Grape',
  'Pepper',
  'Peach',
  'Strawberry',
  'Cherry',
  'Blueberry',
  'Raspberry',
  'Squash',
  'Soybean',
  'Orange',
]

function HomePage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="overflow-hidden rounded-lg border border-[#14532d]/10 bg-white shadow-sm">
        <div className="relative min-h-[560px] bg-[url('https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0f3d2e]/95 via-[#14532d]/72 to-[#f97316]/20" />

          <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_380px] lg:p-10">
            <div className="flex min-h-[480px] flex-col justify-between text-white">
              <div>
                <p className="mb-4 inline-flex rounded-md bg-[#bef264] px-3 py-1 text-sm font-bold text-[#16351f]">
                  Instant AI-powered crop disease detection
                </p>
                <h1 className="max-w-3xl text-4xl font-black sm:text-5xl lg:text-6xl">
                  One leaf photo. Two models. A clearer next step.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-[#ecfdf5] sm:text-lg">
                  CropScan helps smallholder farmers, backyard growers, and field teams
                  check leaf symptoms before disease spreads across the plot.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/signup"
                    className="rounded-md bg-[#bef264] px-5 py-3 text-center text-sm font-black text-[#16351f] transition hover:bg-[#d9f99d]"
                  >
                    Create account
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-md bg-white/12 px-5 py-3 text-center text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/18"
                  >
                    Login to scan
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 pt-8 sm:grid-cols-3">
                {[
                  ['38', 'PlantVillage classes'],
                  ['14', 'launch crops'],
                  ['70%', 'confidence fallback'],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-md border border-white/15 bg-white/12 p-4 backdrop-blur"
                  >
                    <p className="text-3xl font-black">{value}</p>
                    <p className="mt-1 text-sm text-[#ecfdf5]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="self-end rounded-lg border border-white/20 bg-white/95 p-5 shadow-xl shadow-[#0f3d2e]/25 sm:p-6">
              <p className="text-sm font-bold uppercase text-[#15803d]">CropScan workflow</p>
              <h2 className="mt-2 text-2xl font-black text-[#16351f]">
                Ready for real field use
              </h2>
              <div className="mt-5 space-y-4">
                {[
                  ['Login required', 'Scans stay tied to the signed-in user.'],
                  ['Dual prediction', 'EfficientNet-B0 and MobileNetV2 report together.'],
                  ['Saved history', 'Each analysis is kept for dashboard review.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-lg border border-[#14532d]/10 p-4">
                    <h3 className="font-black text-[#16351f]">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#4b5d50]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-[#14532d]/10 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-[#16351f]">
            Built for field decisions
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#4b5d50]">
            The product keeps the workflow simple: take a clear leaf photo, compare
            two lightweight classifiers, and save the result with field notes. When
            confidence is low, CropScan asks for a better image or expert review.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ['Knox Farm fit', 'Useful for varied crops and frequent walk-throughs.'],
              ['No app install', 'Works in a browser on shared or personal phones.'],
              ['Plain advice', 'Treatment text is written for non-expert users.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg bg-[#f0fdf4] p-4 ring-1 ring-[#bbf7d0]">
                <h3 className="font-black text-[#166534]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#4b5d50]">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[#14532d]/10 bg-[#16351f] p-6 text-white shadow-sm">
          <h2 className="text-2xl font-black">Supported crops</h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {supportedCrops.map((crop) => (
              <span
                key={crop}
                className="rounded-md bg-white/10 px-3 py-2 text-sm font-bold text-[#ecfdf5] ring-1 ring-white/15"
              >
                {crop}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomePage
