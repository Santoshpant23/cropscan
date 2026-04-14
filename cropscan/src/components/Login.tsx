import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { getFormValue } from '../lib/forms'

function Login() {
  const { isAuthenticated, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const nextPath = typeof location.state?.from === 'string' ? location.state.from : '/scan'
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await login(getFormValue(event, 'email'), getFormValue(event, 'password'))
      navigate(nextPath, { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Login failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthenticated) return <Navigate to="/scan" replace />

  return (
    <section className="mx-auto grid min-h-[calc(100vh-153px)] max-w-7xl place-items-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-lg border border-[#14532d]/10 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-sm font-bold uppercase text-[#15803d]">
            Welcome back
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#16351f]">
            Login to CropScan
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#4b5d50]">
            Continue checking plant health and documenting field visits.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
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

          <div>
            <label htmlFor="password" className="text-sm font-black text-[#16351f]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full cursor-pointer rounded-md bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#a8b3aa]"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-md bg-[#fff1f2] px-4 py-3 text-sm font-bold text-[#be123c] ring-1 ring-[#fecdd3]">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-[#4b5d50]">
          New to CropScan?{' '}
          <Link to="/signup" className="font-black text-[#15803d] hover:text-[#16351f]">
            Create an account
          </Link>
        </p>
      </div>
    </section>
  )
}

export default Login
