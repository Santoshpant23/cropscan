import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { getFormValue } from '../lib/forms'
import type { UserProfile } from '../types'

function SignUp() {
  const { isAuthenticated, signup } = useAuth()
  const navigate = useNavigate()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Replace with FastAPI signup and store the returned JWT when auth is ready.
    const profile: UserProfile = {
      name: getFormValue(event, 'name'),
      email: getFormValue(event, 'email'),
      role: getFormValue(event, 'role'),
      location: getFormValue(event, 'location') || 'Knox County, TN',
    }
    signup(profile)
    navigate('/scan', { replace: true })
  }

  if (isAuthenticated) return <Navigate to="/scan" replace />

  return (
    <section className="mx-auto grid min-h-[calc(100vh-153px)] max-w-7xl place-items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl rounded-lg border border-[#14532d]/10 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-sm font-bold uppercase text-[#15803d]">
            Get started
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#16351f]">
            Create your CropScan account
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#4b5d50]">
            Save scans, review cases, and keep field notes in one place.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="text-sm font-black text-[#16351f]">
              Full name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="Avery Johnson"
            />
          </div>

          <div>
            <label htmlFor="role" className="text-sm font-black text-[#16351f]">
              Role
            </label>
            <select
              id="role"
              name="role"
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
            >
              <option>Smallholder farmer</option>
              <option>Backyard grower</option>
              <option>Extension agent</option>
              <option>Knox Farm staff</option>
              <option>Student researcher</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="email" className="text-sm font-black text-[#16351f]">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="farmer@example.com"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="location" className="text-sm font-black text-[#16351f]">
              Location
            </label>
            <input
              id="location"
              name="location"
              type="text"
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="Knox County, TN"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-black text-[#16351f]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="Create a password"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="text-sm font-black text-[#16351f]">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="Repeat password"
            />
          </div>

          <button
            type="submit"
            className="cursor-pointer rounded-md bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] sm:col-span-2"
          >
            Create account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#4b5d50]">
          Already have an account?{' '}
          <Link to="/login" className="font-black text-[#15803d] hover:text-[#16351f]">
            Login
          </Link>
        </p>
      </div>
    </section>
  )
}

export default SignUp
