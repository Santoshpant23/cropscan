import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Leaf,
  MapPinned,
  Save,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import {
  createPlotRequest,
  deletePlotRequest,
  geocodeAddressRequest,
  getPlotsRequest,
  updatePlotRequest,
} from '../lib/api'
import type { PlotRecord } from '../types'
import HelpTip from './HelpTip'
import PlotVisual from './PlotVisual'

type PlotLocation = {
  latitude: number
  longitude: number
  label: string
  source: 'gps' | 'address' | 'manual'
}

const CROP_CHOICES = [
  { name: 'Tomato', help: 'Beds and containers' },
  { name: 'Corn', help: 'Rows and small fields' },
  { name: 'Pepper', help: 'Warm-season beds' },
  { name: 'Apple', help: 'Trees and orchard rows' },
  { name: 'Potato', help: 'Rows and bags' },
  { name: 'Squash', help: 'Vines and hills' },
  { name: 'Grape', help: 'Vines and trellis' },
  { name: 'Strawberry', help: 'Berry beds' },
  { name: 'Soybean', help: 'Rows and plots' },
  { name: 'Herbs', help: 'Kitchen garden' },
  { name: 'Lettuce', help: 'Leafy beds' },
  { name: 'Other', help: 'Anything else' },
]

const WIZARD_STEPS = ['Place', 'Check', 'Crops', 'Save']

const AREA_CHOICES = [
  { label: 'Small bed', value: 50, description: 'A few plants' },
  { label: 'Raised bed', value: 120, description: 'One backyard bed' },
  { label: 'Garden row', value: 500, description: 'One longer row' },
  { label: 'Large plot', value: 2000, description: 'A small field area' },
]

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function defaultPlotName(crops: string[]) {
  if (!crops.length) return 'Backyard garden'
  if (crops.length === 1) return `Backyard ${crops[0].toLowerCase()} bed`
  return `${crops[0]} mixed plot`
}

function PlotsPage() {
  const { token } = useAuth()
  const [plots, setPlots] = useState<PlotRecord[]>([])
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({})
  const [selectedLocation, setSelectedLocation] = useState<PlotLocation | null>(null)
  const [address, setAddress] = useState('')
  const [manualLatitude, setManualLatitude] = useState('')
  const [manualLongitude, setManualLongitude] = useState('')
  const [selectedCrops, setSelectedCrops] = useState<string[]>([])
  const [plotName, setPlotName] = useState('')
  const [areaSqFt, setAreaSqFt] = useState(120)
  const [notes, setNotes] = useState('')
  const [creationStep, setCreationStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFindingLocation, setIsFindingLocation] = useState(false)
  const [isLookingUpAddress, setIsLookingUpAddress] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const totalArea = useMemo(
    () => Math.round(plots.reduce((total, plot) => total + plot.areaSqFt, 0)),
    [plots],
  )
  const suggestedName = plotName || defaultPlotName(selectedCrops)
  const canSavePlot = Boolean(selectedLocation && selectedCrops.length && suggestedName)

  useEffect(() => {
    if (!token) return

    const activeToken = token
    let isMounted = true
    async function loadPlots() {
      setIsLoading(true)
      setError('')
      try {
        const serverPlots = await getPlotsRequest(activeToken)
        if (!isMounted) return
        setPlots(serverPlots)
        setDraftNotes(
          Object.fromEntries(serverPlots.map((plot) => [plot.id, plot.notes || ''])),
        )
      } catch (caughtError) {
        if (!isMounted) return
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Could not load plots.',
        )
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadPlots()

    return () => {
      isMounted = false
    }
  }, [token])

  function toggleCrop(crop: string) {
    setSelectedCrops((currentCrops) =>
      currentCrops.includes(crop)
        ? currentCrops.filter((currentCrop) => currentCrop !== crop)
        : [...currentCrops, crop],
    )
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setError('This browser cannot use current location. Try address search.')
      return
    }

    setIsFindingLocation(true)
    setError('')
    setSuccess('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: 'Current location',
          source: 'gps',
        })
        setCreationStep(2)
        setIsFindingLocation(false)
      },
      () => {
        setError('Location permission was blocked. Try address search instead.')
        setIsFindingLocation(false)
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }

  async function handleAddressLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token || !address.trim()) return

    setIsLookingUpAddress(true)
    setError('')
    setSuccess('')
    try {
      const result = await geocodeAddressRequest(address.trim(), token)
      setSelectedLocation({
        latitude: result.latitude,
        longitude: result.longitude,
        label: result.label,
        source: 'address',
      })
      setCreationStep(2)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not find that address.',
      )
    } finally {
      setIsLookingUpAddress(false)
    }
  }

  function handleManualLocation() {
    const latitude = Number(manualLatitude)
    const longitude = Number(manualLongitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Enter both numbers, or use current location instead.')
      return
    }

    if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) {
      setError('That location is not a real plot. Try current location or address.')
      return
    }

    setSelectedLocation({
      latitude,
      longitude,
      label: 'Custom map point',
      source: 'manual',
    })
    setCreationStep(2)
    setError('')
  }

  async function handleCreatePlot() {
    if (!token || !selectedLocation || !canSavePlot || isSaving) return

    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      const savedPlot = await createPlotRequest(
        {
          name: suggestedName.trim(),
          crop: selectedCrops.join(', '),
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          areaSqFt,
          locationLabel: selectedLocation.label,
          locationSource: selectedLocation.source,
          notes: notes.trim(),
        },
        token,
      )
      setPlots((currentPlots) => [savedPlot, ...currentPlots])
      setDraftNotes((currentNotes) => ({
        ...currentNotes,
        [savedPlot.id]: savedPlot.notes || '',
      }))
      setSelectedLocation(null)
      setSelectedCrops([])
      setPlotName('')
      setAreaSqFt(120)
      setNotes('')
      setAddress('')
      setManualLatitude('')
      setManualLongitude('')
      setCreationStep(1)
      setSuccess('Plot saved.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Could not save plot.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveNotes(plot: PlotRecord) {
    if (!token) return

    setError('')
    setSuccess('')
    const nextNotes = draftNotes[plot.id] ?? ''
    try {
      const updatedPlot = await updatePlotRequest(plot.id, { notes: nextNotes }, token)
      setPlots((currentPlots) =>
        currentPlots.map((currentPlot) =>
          currentPlot.id === plot.id ? updatedPlot : currentPlot,
        ),
      )
      setSuccess('Plot note saved.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not save plot note.',
      )
    }
  }

  async function handleDeletePlot(plotId: string) {
    if (!token) return
    if (!window.confirm('Delete this plot?')) return

    const previousPlots = plots
    setPlots((currentPlots) => currentPlots.filter((plot) => plot.id !== plotId))
    setError('')
    setSuccess('')
    try {
      await deletePlotRequest(plotId, token)
    } catch (caughtError) {
      setPlots(previousPlots)
      setError(
        caughtError instanceof Error ? caughtError.message : 'Could not delete plot.',
      )
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-10 pt-4 sm:pt-6 lg:max-w-5xl lg:px-8 lg:pt-10">
      <div className="grid gap-6 lg:grid-cols-[480px_1fr]">
        <div className="crop-fade-up rounded-2xl border border-stroke bg-white p-6 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-leaf-700">
              Growing spots
            </p>
            <HelpTip label="Growing spot">
              A growing spot is one bed, row, greenhouse bench, or small field you
              want CropScan to remember.
            </HelpTip>
          </div>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
            Add a growing spot
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            Start with where the plants are. CropScan can use that place later for
            weather, frost, and follow-up reminders.
          </p>

          <ol className="mt-7 grid grid-cols-4 gap-2">
            {WIZARD_STEPS.map((label, index) => {
              const stepNumber = index + 1
              const isActive = creationStep === stepNumber
              const isDone = creationStep > stepNumber
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => setCreationStep(stepNumber)}
                    className={`crop-touch flex w-full flex-col items-center justify-center gap-1 rounded-md px-2 transition ${
                      isActive
                        ? 'bg-forest-700 text-white shadow-sm'
                        : isDone
                          ? 'bg-leaf-300/30 text-leaf-700'
                          : 'bg-canvas text-muted ring-1 ring-stroke hover:bg-surface-2'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                      ) : (
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                            isActive
                              ? 'bg-lime text-forest-900'
                              : 'bg-white/60 text-current ring-1 ring-current/20'
                          }`}
                        >
                          {stepNumber}
                        </span>
                      )}
                      {label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="mt-5 rounded-lg border border-stroke bg-white p-4 shadow-sm">
            {creationStep === 1 ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black uppercase text-leaf-500">
                    Where are the plants?
                  </p>
                  <HelpTip label="Location">
                    Use current location when standing near the plants. Type an
                    address only when you are away from the plot.
                  </HelpTip>
                </div>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isFindingLocation}
                  className="crop-touch mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-lime-soft disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline disabled:shadow-none disabled:hover:translate-y-0"
                >
                  <MapPinned className="h-5 w-5" strokeWidth={2.2} />
                  {isFindingLocation ? 'Finding your spot...' : 'Use my current location'}
                </button>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Best when you are standing near the bed, row, or field.
                </p>

                <form onSubmit={handleAddressLookup} className="mt-5 rounded-md bg-leaf-300/20 p-3">
                  <label
                    htmlFor="address"
                    className="text-sm font-black text-forest-700"
                  >
                    Not there right now? Type an address.
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="address"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      className="min-h-12 flex-1 rounded-md border border-stroke bg-white px-4 py-3 text-forest-700 outline-none transition focus:border-leaf-500 focus:ring-4 focus:ring-leaf-300/40"
                      placeholder="Street, city, state"
                    />
                    <button
                      type="submit"
                      disabled={isLookingUpAddress || !address.trim()}
                      className="min-h-12 cursor-pointer rounded-md bg-sun-orange px-5 py-3 text-sm font-black text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-surface-2"
                    >
                      {isLookingUpAddress ? 'Looking...' : 'Find'}
                    </button>
                  </div>
                </form>

                <details className="mt-4 rounded-md bg-white p-3 ring-1 ring-stroke">
                  <summary className="cursor-pointer text-sm font-black text-forest-700">
                    Advanced: type map numbers
                  </summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={manualLatitude}
                      onChange={(event) => setManualLatitude(event.target.value)}
                      type="number"
                      step="0.000001"
                      className="min-h-12 rounded-md border border-stroke px-3 py-2 text-sm outline-none focus:border-leaf-500 focus:ring-4 focus:ring-leaf-300/40"
                      placeholder="Latitude"
                    />
                    <input
                      value={manualLongitude}
                      onChange={(event) => setManualLongitude(event.target.value)}
                      type="number"
                      step="0.000001"
                      className="min-h-12 rounded-md border border-stroke px-3 py-2 text-sm outline-none focus:border-leaf-500 focus:ring-4 focus:ring-leaf-300/40"
                      placeholder="Longitude"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleManualLocation}
                    className="mt-3 min-h-12 w-full cursor-pointer rounded-md border border-stroke bg-white px-4 py-2 text-sm font-black text-forest-700 transition hover:bg-leaf-300/20"
                  >
                    Use these numbers
                  </button>
                </details>
              </div>
            ) : null}

            {creationStep === 2 ? (
              <div>
                <p className="text-sm font-black uppercase text-leaf-500">
                  Confirm this spot
                </p>
                {selectedLocation ? (
                  <>
                    <div className="mt-3">
                      <PlotVisual crop={selectedCrops.join(', ') || 'Garden'} name="Selected spot" />
                    </div>
                    <p className="mt-3 rounded-md bg-leaf-300/20 px-3 py-2 text-sm font-bold text-muted">
                      {selectedLocation.label}
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase text-outline">
                      Saved from{' '}
                      {selectedLocation.source === 'gps'
                        ? 'current location'
                        : selectedLocation.source === 'address'
                          ? 'address search'
                          : 'advanced entry'}
                    </p>
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setCreationStep(1)}
                        className="crop-touch inline-flex items-center justify-center gap-2 rounded-md border border-stroke bg-white px-4 text-sm font-bold text-forest-900 transition hover:border-leaf-700 hover:bg-canvas"
                      >
                        <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
                        Change spot
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreationStep(3)}
                        className="crop-touch inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-forest-700 px-4 text-sm font-bold text-white transition hover:bg-forest-900"
                      >
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
                        This is right
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCreationStep(1)}
                    className="mt-4 min-h-12 w-full cursor-pointer rounded-md bg-forest-700 px-4 py-2 text-sm font-black text-white transition hover:bg-forest-500"
                  >
                    Choose location first
                  </button>
                )}
              </div>
            ) : null}

            {creationStep === 3 ? (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black uppercase text-sun-orange">
                    What grows here?
                  </p>
                  <HelpTip label="Crops">
                    Pick the main crops in this spot. This helps weather and scan
                    guidance sound specific.
                  </HelpTip>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {CROP_CHOICES.map((crop) => {
                    const isSelected = selectedCrops.includes(crop.name)
                    return (
                      <button
                        key={crop.name}
                        type="button"
                        onClick={() => toggleCrop(crop.name)}
                        className={`flex min-h-24 flex-col items-start gap-2 rounded-xl px-3 py-3 text-left transition ${
                          isSelected
                            ? 'bg-forest-700 text-white shadow-sm ring-2 ring-lime'
                            : 'bg-canvas text-forest-900 ring-1 ring-stroke hover:bg-surface-2'
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-full ${
                            isSelected
                              ? 'bg-lime text-forest-900'
                              : 'bg-leaf-300/30 text-leaf-700'
                          }`}
                        >
                          <Leaf className="h-4.5 w-4.5" strokeWidth={2.2} />
                        </span>
                        <span className="block text-sm font-bold tracking-tight">
                          {crop.name}
                        </span>
                        <span className="block text-xs opacity-80">{crop.help}</span>
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  disabled={!selectedCrops.length}
                  onClick={() => setCreationStep(4)}
                  className="crop-touch mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-forest-700 px-5 text-sm font-bold text-white transition hover:bg-forest-900 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline"
                >
                  Continue
                </button>
              </div>
            ) : null}

            {creationStep === 4 ? (
              <div>
                <p className="text-sm font-black uppercase text-leaf-500">
                  Name it and choose size
                </p>
                <label htmlFor="plotName" className="mt-3 block text-sm font-black">
                  Name
                </label>
                <input
                  id="plotName"
                  value={plotName}
                  onChange={(event) => setPlotName(event.target.value)}
                  className="mt-2 min-h-12 w-full rounded-md border border-stroke bg-white px-4 py-3 text-forest-700 outline-none transition focus:border-leaf-500 focus:ring-4 focus:ring-leaf-300/40"
                  placeholder={defaultPlotName(selectedCrops)}
                />

                <p className="mt-4 text-sm font-black">About how big?</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {AREA_CHOICES.map((choice) => {
                    const isSelected = areaSqFt === choice.value
                    return (
                      <button
                        key={choice.label}
                        type="button"
                        onClick={() => setAreaSqFt(choice.value)}
                        className={`min-h-16 cursor-pointer rounded-md px-3 py-3 text-left transition ${
                          isSelected
                            ? 'bg-leaf-300/30 text-leaf-700 ring-2 ring-leaf-500'
                            : 'bg-canvas text-forest-700 ring-1 ring-stroke hover:bg-leaf-300/20'
                        }`}
                      >
                        <span className="block text-sm font-black">{choice.label}</span>
                        <span className="mt-1 block text-xs font-bold opacity-80">
                          {choice.description}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <label htmlFor="notes" className="mt-4 block text-sm font-black">
                  Anything to remember?
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="mt-2 w-full resize-none rounded-md border border-stroke bg-white px-4 py-3 text-forest-700 outline-none transition focus:border-leaf-500 focus:ring-4 focus:ring-leaf-300/40"
                  placeholder="Drip irrigation, shade in afternoon, planted last week"
                />

                <button
                  type="button"
                  disabled={!canSavePlot || isSaving}
                  onClick={() => {
                    void handleCreatePlot()
                  }}
                  className="crop-touch mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-lime-soft disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline disabled:shadow-none disabled:hover:translate-y-0"
                >
                  <Save className="h-5 w-5" strokeWidth={2.2} />
                  {isSaving ? 'Saving spot...' : 'Save growing spot'}
                </button>
              </div>
            ) : null}
          </div>

          {success ? (
            <p className="mt-4 rounded-md bg-leaf-300/20 px-4 py-3 text-sm font-bold text-leaf-700 ring-1 ring-leaf-300/40">
              {success}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-danger ring-1 ring-red-200">
              {error}
            </p>
          ) : null}
        </div>

        <div className="crop-fade-up rounded-2xl bg-forest-900 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-lime">
                Saved growing spots
              </p>
              <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {plots.length} {plots.length === 1 ? 'spot' : 'spots'}, about {totalArea} sq ft
              </h2>
            </div>
            <Link
              to="/scan"
              className="crop-touch inline-flex items-center justify-center gap-2 rounded-md bg-white/10 px-5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/20"
            >
              <Camera className="h-4.5 w-4.5" strokeWidth={2.2} />
              Scan a leaf
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-8 space-y-4">
              <div className="h-32 animate-pulse rounded-lg bg-white/15" />
              <div className="h-32 animate-pulse rounded-lg bg-white/15" />
            </div>
          ) : plots.length === 0 ? (
            <div className="mt-8 rounded-lg border border-white/15 bg-white/8 p-6">
              <p className="text-lg font-black text-white">No growing spots yet</p>
              <p className="mt-2 text-sm leading-6 text-canvas/90">
                Add the first bed, row, or field so future scan history can connect
                to a real place.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-4">
              {plots.map((plot) => (
                <article
                  key={plot.id}
                  className="grid gap-4 rounded-lg border border-white/10 bg-white p-4 text-forest-700 shadow-sm md:grid-cols-[160px_1fr]"
                >
                  <PlotVisual crop={plot.crop} name={plot.name} compact />

                  <div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-leaf-500">
                          {plot.crop}
                        </p>
                        <h3 className="mt-1 text-2xl font-black text-forest-700">
                          {plot.name}
                        </h3>
                        <p className="mt-1 text-sm font-bold text-muted">
                          {plot.locationLabel || 'Saved map point'} - about{' '}
                          {Math.round(plot.areaSqFt)} sq ft - saved{' '}
                          {formatDate(plot.createdAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeletePlot(plot.id)
                        }}
                        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-red-300 bg-white px-3 text-sm font-bold text-danger transition hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2.2} />
                        Delete
                      </button>
                    </div>

                    <div className="mt-4">
                      <label
                        htmlFor={`plot-notes-${plot.id}`}
                        className="text-sm font-black text-forest-700"
                      >
                        Notes
                      </label>
                      <textarea
                        id={`plot-notes-${plot.id}`}
                        value={draftNotes[plot.id] ?? ''}
                        onChange={(event) =>
                          setDraftNotes((currentNotes) => ({
                            ...currentNotes,
                            [plot.id]: event.target.value,
                          }))
                        }
                        rows={3}
                        className="mt-2 w-full resize-none rounded-md border border-stroke bg-white px-3 py-2 text-sm text-forest-700 outline-none transition focus:border-leaf-500 focus:ring-4 focus:ring-leaf-300/40"
                        placeholder="Soil, irrigation, disease pressure, or harvest notes"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void handleSaveNotes(plot)
                      }}
                      className="mt-3 min-h-11 cursor-pointer rounded-md bg-forest-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-forest-500"
                    >
                      Save note
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default PlotsPage
