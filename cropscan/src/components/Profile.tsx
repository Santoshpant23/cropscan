import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { getFormValue } from '../lib/forms'
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../lib/storage'
import type { UserProfile } from '../types'

function Profile() {
  const { user, updateProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [savedMessage, setSavedMessage] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const profile: UserProfile = {
      name: getFormValue(event, 'name'),
      email: getFormValue(event, 'email'),
      role: getFormValue(event, 'role'),
      location: getFormValue(event, 'location'),
    }

    updateProfile(profile)
    setSavedMessage('Profile updated locally.')
  }

  function handleDeleteLocalProfile() {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(AUTH_USER_KEY)
    logout()
    navigate('/')
  }

  if (!user) return null

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-[#14532d]/10 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase text-[#15803d]">Account</p>
          <h1 className="mt-2 text-3xl font-black text-[#16351f]">Profile settings</h1>
          <p className="mt-2 text-sm leading-6 text-[#4b5d50]">
            Update the account details connected to saved scans and field history.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="text-sm font-black text-[#16351f]">
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                defaultValue={user.name}
                required
                className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              />
            </div>

            <div>
              <label htmlFor="role" className="text-sm font-black text-[#16351f]">
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue={user.role}
                className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              >
                <option>Smallholder farmer</option>
                <option>Backyard grower</option>
                <option>Extension agent</option>
                <option>Knox Farm staff</option>
                <option>Student researcher</option>
              </select>
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-black text-[#16351f]">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={user.email}
                required
                className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              />
            </div>

            <div>
              <label htmlFor="location" className="text-sm font-black text-[#16351f]">
                Location
              </label>
              <input
                id="location"
                name="location"
                type="text"
                defaultValue={user.location}
                className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              />
            </div>

            <button
              type="submit"
              className="cursor-pointer rounded-md bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] sm:col-span-2"
            >
              Save profile
            </button>
          </form>

          {savedMessage && (
            <p className="mt-4 rounded-md bg-[#f0fdf4] px-4 py-3 text-sm font-bold text-[#166534] ring-1 ring-[#bbf7d0]">
              {savedMessage}
            </p>
          )}
        </div>

        <aside className="rounded-lg bg-[#16351f] p-6 text-white shadow-sm">
          <h2 className="text-2xl font-black">Local account</h2>
          <p className="mt-3 text-sm leading-6 text-[#d1fae5]">
            Your session is stored locally now and can be replaced by the backend
            login flow later without changing these pages.
          </p>
          <div className="mt-5 rounded-lg bg-white/10 p-4 ring-1 ring-white/15">
            <p className="text-xs font-bold uppercase text-[#bef264]">Signed in as</p>
            <p className="mt-1 break-words text-sm font-bold">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-5 w-full cursor-pointer rounded-md bg-white/10 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            Logout
          </button>
          <button
            type="button"
            onClick={handleDeleteLocalProfile}
            className="mt-3 w-full cursor-pointer rounded-md bg-[#fff1f2] px-4 py-2 text-sm font-black text-[#be123c] transition hover:bg-white"
          >
            Delete local profile
          </button>
        </aside>
      </div>
    </section>
  )
}

export default Profile
