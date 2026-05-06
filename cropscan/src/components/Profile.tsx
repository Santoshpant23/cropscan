import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  LogOut,
  Mail,
  MapPin,
  Save,
  Shield,
  Trash2,
  User,
  UserCog,
} from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getFormValue } from '../lib/forms'
import { getInitials } from '../lib/format'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../lib/storage'
import type { UserProfile } from '../types'

function Profile() {
  const { user, updateProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [savedMessage, setSavedMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSavedMessage('')

    const profile: UserProfile = {
      name: getFormValue(event, 'name'),
      email: getFormValue(event, 'email'),
      role: getFormValue(event, 'role'),
      location: getFormValue(event, 'location'),
    }

    setIsSubmitting(true)
    try {
      await updateProfile(profile)
      setSavedMessage('Profile updated.')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Profile update failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDeleteLocalProfile() {
    if (!window.confirm('Permanently delete this account from this browser?')) return
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    logout()
    navigate('/')
  }

  if (!user) return null

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-10 pt-4 sm:pt-6 lg:max-w-4xl lg:px-8 lg:pt-10">
      <div className="rounded-lg border border-stroke bg-surface p-5 shadow-sm sm:p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <span className="font-display flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-forest-700 text-2xl font-bold tracking-tight text-lime">
            {getInitials(user.name)}
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-leaf-700">
              Your profile
            </p>
            <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
              {user.name}
            </h1>
            <p className="mt-1 text-sm font-medium text-muted">{user.email}</p>
          </div>
        </div>

        <hr className="my-8 border-stroke" />

        <section>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-leaf-700">
            <UserCog className="h-3.5 w-3.5" strokeWidth={2.4} />
            Account
          </p>
          <h2 className="font-display mt-2 text-xl font-bold tracking-tight text-forest-900">
            Profile settings
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Update the account details connected to saved scans and field history.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-bold text-forest-700">
                Full name
              </label>
              <div className="relative mt-2">
                <User
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline"
                  strokeWidth={2}
                />
                <input
                  id="name"
                  name="name"
                  type="text"
                  defaultValue={user.name}
                  required
                  className="crop-touch w-full rounded-md border border-stroke bg-canvas pl-12 pr-4 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-white focus:ring-4 focus:ring-leaf-300/40"
                />
              </div>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-bold text-forest-700">
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue={user.role}
                className="crop-touch mt-2 w-full rounded-md border border-stroke bg-canvas px-4 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-white focus:ring-4 focus:ring-leaf-300/40"
              >
                <option>Smallholder farmer</option>
                <option>Backyard grower</option>
                <option>Extension agent</option>
                <option>Knox Farm staff</option>
                <option>Student researcher</option>
              </select>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-forest-700">
                Email address
              </label>
              <div className="relative mt-2">
                <Mail
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline"
                  strokeWidth={2}
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={user.email}
                  required
                  className="crop-touch w-full rounded-md border border-stroke bg-canvas pl-12 pr-4 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-white focus:ring-4 focus:ring-leaf-300/40"
                />
              </div>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-bold text-forest-700">
                Location
              </label>
              <div className="relative mt-2">
                <MapPin
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline"
                  strokeWidth={2}
                />
                <input
                  id="location"
                  name="location"
                  type="text"
                  defaultValue={user.location}
                  className="crop-touch w-full rounded-md border border-stroke bg-canvas pl-12 pr-4 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-white focus:ring-4 focus:ring-leaf-300/40"
                  placeholder="Knox County, TN"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="crop-touch inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-lime-soft disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline disabled:shadow-none disabled:hover:translate-y-0 sm:col-span-2"
            >
              <Save className="h-5 w-5" strokeWidth={2.2} />
              {isSubmitting ? 'Saving profile...' : 'Save profile'}
            </button>
          </form>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-danger ring-1 ring-red-200"
            >
              {error}
            </p>
          )}
          {savedMessage && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-leaf-300/20 px-4 py-3 text-sm font-bold text-leaf-700 ring-1 ring-leaf-300/40">
              <Shield className="h-4 w-4" strokeWidth={2.4} />
              {savedMessage}
            </p>
          )}
        </section>

        <hr className="my-8 border-stroke" />

        <section>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-leaf-700">
            <Shield className="h-3.5 w-3.5" strokeWidth={2.4} />
            Session
          </p>
          <h2 className="font-display mt-2 text-xl font-bold tracking-tight text-forest-900">
            Local account
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your session is stored locally on this browser and can be replaced by
            a backend login flow later without changing this page.
          </p>
          <button
            type="button"
            onClick={logout}
            className="crop-touch mt-5 inline-flex items-center justify-center gap-2 rounded-md border border-stroke bg-white px-5 text-sm font-bold text-forest-900 transition hover:border-leaf-700 hover:bg-canvas"
          >
            <LogOut className="h-4.5 w-4.5" strokeWidth={2.2} />
            Logout
          </button>
        </section>

        <hr className="my-8 border-stroke" />

        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-danger">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.4} />
            Danger zone
          </p>
          <h2 className="font-display mt-2 text-xl font-bold tracking-tight text-forest-900">
            Delete local profile
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Permanently remove the account and saved session from this browser.
            This action cannot be undone.
          </p>
          <button
            type="button"
            onClick={handleDeleteLocalProfile}
            className="crop-touch mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-danger px-5 text-sm font-bold text-white transition hover:bg-danger"
          >
            <Trash2 className="h-4.5 w-4.5" strokeWidth={2.2} />
            Delete local profile
          </button>
        </section>
      </div>
    </section>
  )
}

export default Profile
