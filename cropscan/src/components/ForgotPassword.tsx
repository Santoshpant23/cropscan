import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { getFormValue } from '../lib/forms'
import { forgotPasswordRequest } from '../lib/api'

function ForgotPassword() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const newPassword = getFormValue(event, 'newPassword')
    const confirmPassword = getFormValue(event, 'confirmPassword')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await forgotPasswordRequest(
        getFormValue(event, 'email'),
        newPassword,
      )
      setSuccess(response.message)
      window.setTimeout(() => navigate('/login', { replace: true }), 1200)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Password reset failed.',
      )
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
            Password help
          </p>
          <h1 className="mt-2 text-3xl font-black text-[#16351f]">
            Reset your password
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#4b5d50]">
            Enter your account email and choose a new password to get back into
            CropScan.
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
            <label
              htmlFor="newPassword"
              className="text-sm font-black text-[#16351f]"
            >
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="Enter a new password"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="text-sm font-black text-[#16351f]"
            >
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="Re-enter your new password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full cursor-pointer rounded-md bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#a8b3aa]"
          >
            {isSubmitting ? 'Resetting...' : 'Reset password'}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-md bg-[#fff1f2] px-4 py-3 text-sm font-bold text-[#be123c] ring-1 ring-[#fecdd3]">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-4 rounded-md bg-[#f0fdf4] px-4 py-3 text-sm font-bold text-[#166534] ring-1 ring-[#bbf7d0]">
            {success}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-[#4b5d50]">
          Remembered it?{' '}
          <Link to="/login" className="font-black text-[#15803d] hover:text-[#16351f]">
            Back to login
          </Link>
        </p>
      </div>
    </section>
  )
}

export default ForgotPassword
