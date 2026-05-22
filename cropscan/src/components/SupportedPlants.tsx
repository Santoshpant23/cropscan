import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Leaf, ScanSearch, ShieldCheck } from 'lucide-react'

const SUPPORTED_PLANTS = [
  {
    name: 'Apple',
    classes: ['Apple Scab', 'Black Rot', 'Cedar Apple Rust', 'Healthy'],
  },
  {
    name: 'Blueberry',
    classes: ['Healthy'],
  },
  {
    name: 'Cherry',
    classes: ['Powdery Mildew', 'Healthy'],
  },
  {
    name: 'Corn',
    classes: [
      'Cercospora Leaf Spot / Gray Leaf Spot',
      'Common Rust',
      'Northern Leaf Blight',
      'Healthy',
    ],
  },
  {
    name: 'Grape',
    classes: [
      'Black Rot',
      'Esca (Black Measles)',
      'Leaf Blight (Isariopsis Leaf Spot)',
      'Healthy',
    ],
  },
  {
    name: 'Orange',
    classes: ['Huanglongbing (Citrus Greening)'],
  },
  {
    name: 'Peach',
    classes: ['Bacterial Spot', 'Healthy'],
  },
  {
    name: 'Bell pepper',
    classes: ['Bacterial Spot', 'Healthy'],
  },
  {
    name: 'Potato',
    classes: ['Early Blight', 'Late Blight', 'Healthy'],
  },
  {
    name: 'Raspberry',
    classes: ['Healthy'],
  },
  {
    name: 'Soybean',
    classes: ['Healthy'],
  },
  {
    name: 'Squash',
    classes: ['Powdery Mildew'],
  },
  {
    name: 'Strawberry',
    classes: ['Leaf Scorch', 'Healthy'],
  },
  {
    name: 'Tomato',
    classes: [
      'Bacterial Spot',
      'Early Blight',
      'Late Blight',
      'Leaf Mold',
      'Septoria Leaf Spot',
      'Spider Mites Two Spotted Spider Mite',
      'Target Spot',
      'Tomato Yellow Leaf Curl Virus',
      'Tomato Mosaic Virus',
      'Healthy',
    ],
  },
]

const totalClasses = SUPPORTED_PLANTS.reduce(
  (sum, plant) => sum + plant.classes.length,
  0,
)

function SupportedPlants() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6 pb-12 pt-6 sm:pt-10 lg:px-8">
      <div className="crop-fade-up overflow-hidden rounded-xl bg-forest-900 text-white">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-xs font-bold uppercase tracking-wider text-forest-900">
              <Leaf className="h-3.5 w-3.5" strokeWidth={2.5} />
              Supported plants
            </span>
            <h1 className="font-display mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Scan leaves from the crops CropScan was trained to recognize.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-canvas/85">
              CropScan currently supports {SUPPORTED_PLANTS.length} plant groups and{' '}
              {totalClasses} model classes. If a leaf is from another crop, use the
              result as a prompt to take better notes, not as a diagnosis.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 self-end">
            <StatCard value={`${SUPPORTED_PLANTS.length}`} label="plant groups" />
            <StatCard value={`${totalClasses}`} label="classes" />
            <StatCard value="2" label="models compare" />
            <StatCard value="1+" label="leaf photos" />
          </div>
        </div>
      </div>

      <div className="crop-fade-up mt-6 grid gap-4 sm:grid-cols-3">
        <InfoStrip
          Icon={ScanSearch}
          title="Use one clear leaf"
          text="The model works best when the leaf fills most of the frame."
        />
        <InfoStrip
          Icon={ShieldCheck}
          title="Avoid random plants"
          text="Unsupported crops can produce unstable or misleading predictions."
        />
        <InfoStrip
          Icon={CheckCircle2}
          title="Healthy is a class"
          text="Several crops include healthy leaves as a supported class."
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SUPPORTED_PLANTS.map((plant, index) => (
          <article
            key={plant.name}
            className="crop-fade-up rounded-lg border border-stroke bg-surface p-5 shadow-sm"
            style={{ animationDelay: `${index * 35}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-leaf-700">
                  {plant.classes.length} class{plant.classes.length === 1 ? '' : 'es'}
                </p>
                <h2 className="font-display mt-1 text-xl font-bold tracking-tight text-forest-900">
                  {plant.name}
                </h2>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-leaf-300/25 text-leaf-700">
                <Leaf className="h-5 w-5" strokeWidth={2.2} />
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {plant.classes.map((className) => (
                <span
                  key={className}
                  className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-muted ring-1 ring-stroke"
                >
                  {className}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="crop-fade-up mt-8 rounded-lg border border-stroke bg-surface p-5 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-forest-900">
            Ready to scan a supported leaf?
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Sign in, upload a close photo, and compare the model outputs before taking action.
          </p>
        </div>
        <Link
          to="/signup"
          className="crop-touch mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-sm font-bold text-forest-900 shadow-sm transition hover:bg-lime-soft sm:mt-0 sm:w-auto"
        >
          Create account
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  )
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-white/10 p-4 ring-1 ring-white/15">
      <p className="font-display text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-canvas/75">
        {label}
      </p>
    </div>
  )
}

function InfoStrip({
  Icon,
  title,
  text,
}: {
  Icon: typeof Leaf
  title: string
  text: string
}) {
  return (
    <div className="rounded-lg border border-stroke bg-surface p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-leaf-300/25 text-leaf-700">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <h2 className="mt-3 text-sm font-bold text-forest-900">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{text}</p>
    </div>
  )
}

export default SupportedPlants
