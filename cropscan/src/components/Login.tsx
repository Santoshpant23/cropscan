import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getFormValue } from '../lib/forms'

function Login() {
  const { isAuthenticated, login } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const nextPath = typeof location.state?.from === 'string' ? location.state.from : '/'
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

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

  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <section className="mx-auto w-full max-w-md px-6 pb-12 pt-6 sm:pt-10 lg:max-w-lg lg:pt-16">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
          Welcome Back
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Continue checking plant health and documenting field visits.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-bold text-forest-700">
            Email Address
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
              autoComplete="email"
              required
              className="crop-touch w-full rounded-md border border-stroke bg-surface-2 pl-12 pr-4 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-surface focus:ring-4 focus:ring-leaf-300/40"
              placeholder="farmer@example.com"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-bold text-forest-700">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-bold text-leaf-700 transition hover:text-forest-900"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-2">
            <Lock
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline"
              strokeWidth={2}
            />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              className="crop-touch w-full rounded-md border border-stroke bg-surface-2 pl-12 pr-12 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-surface focus:ring-4 focus:ring-leaf-300/40"
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-outline transition hover:bg-canvas hover:text-forest-900"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" strokeWidth={2} />
              ) : (
                <Eye className="h-5 w-5" strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-danger ring-1 ring-red-200"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="crop-touch inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:bg-lime-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline disabled:shadow-none"
        >
          {isSubmitting ? 'Logging in…' : 'Login'}
          {!isSubmitting ? <ArrowRight className="h-5 w-5" strokeWidth={2.5} /> : null}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="font-bold text-leaf-700 hover:text-forest-900">
          Create one
        </Link>
      </p>
    </section>
  )
}

export default Login
