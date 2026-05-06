import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import { getFormValue } from '../lib/forms'
import {
  confirmPasswordReset,
  requestPasswordReset,
} from '../lib/api'

const RESEND_COOLDOWN_SECONDS = 45

function ForgotPassword() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [debugOtp, setDebugOtp] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const canResendCode = resendCooldown === 0 && !isResending

  useEffect(() => {
    if (resendCooldown === 0) return
    const timeoutId = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearTimeout(timeoutId)
  }, [resendCooldown])

  function startResendCooldown() {
    setResendCooldown(RESEND_COOLDOWN_SECONDS)
  }

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setDebugOtp('')

    const requestedEmail = getFormValue(event, 'email').trim()
    setIsSubmitting(true)
    try {
      const response = await requestPasswordReset(requestedEmail)
      setEmail(requestedEmail)
      setIsCodeSent(true)
      setSuccess(response.message)
      startResendCooldown()
      if (response.debugOtp) setDebugOtp(response.debugOtp)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not send reset code.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmReset(event: FormEvent<HTMLFormElement>) {
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
      const response = await confirmPasswordReset(
        email,
        getFormValue(event, 'otpCode').trim(),
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

  async function handleResendCode() {
    if (!email || !canResendCode) return
    setError('')
    setSuccess('')
    setDebugOtp('')
    setIsResending(true)
    try {
      const response = await requestPasswordReset(email)
      setSuccess(response.message)
      startResendCooldown()
      if (response.debugOtp) setDebugOtp(response.debugOtp)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not resend reset code.',
      )
    } finally {
      setIsResending(false)
    }
  }

  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <section className="mx-auto w-full max-w-md px-6 pb-12 pt-6 sm:pt-10 lg:max-w-lg lg:pt-16">
      <header>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-md bg-leaf-300/30 text-leaf-700">
          <KeyRound className="h-6 w-6" strokeWidth={2} />
        </span>
        <h1 className="mt-5 font-display text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
          Forgot your password?
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Enter the email associated with your account and we&apos;ll send a reset code.
        </p>
      </header>

      {!isCodeSent ? (
        <form onSubmit={handleRequestCode} className="mt-8 space-y-5">
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
                autoComplete="email"
                required
                className="crop-touch w-full rounded-md border border-stroke bg-surface-2 pl-12 pr-4 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-surface focus:ring-4 focus:ring-leaf-300/40"
                placeholder="farmer@example.com"
              />
            </div>
          </div>

          {error ? <ErrorMessage message={error} /> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="crop-touch inline-flex w-full items-center justify-center rounded-md bg-lime px-6 text-base font-bold text-forest-900 shadow-sm transition hover:bg-lime-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline disabled:shadow-none"
          >
            {isSubmitting ? 'Sending code…' : 'Send reset code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleConfirmReset} className="mt-8 space-y-5">
          <p className="rounded-md bg-leaf-300/20 px-4 py-3 text-sm font-bold text-leaf-700 ring-1 ring-leaf-300/40">
            Check {email} for your reset code.
          </p>
          {success ? (
            <p className="rounded-md bg-leaf-300/20 px-4 py-3 text-sm font-bold text-leaf-700 ring-1 ring-leaf-300/40">
              {success}
            </p>
          ) : null}
          {debugOtp ? (
            <p className="rounded-md bg-sun-orange-soft px-4 py-3 text-sm font-bold text-sun-orange ring-1 ring-sun-orange/30">
              Local dev code: {debugOtp}
            </p>
          ) : null}

          <div>
            <label htmlFor="otpCode" className="block text-sm font-bold text-forest-700">
              Reset code
            </label>
            <input
              id="otpCode"
              name="otpCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              className="crop-touch mt-2 w-full rounded-md border border-stroke bg-surface-2 px-4 text-center text-lg font-bold tracking-[0.4em] text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-surface focus:ring-4 focus:ring-leaf-300/40"
              placeholder="123456"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-bold text-forest-700">
              New password
            </label>
            <div className="relative mt-2">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline"
                strokeWidth={2}
              />
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="crop-touch w-full rounded-md border border-stroke bg-surface-2 pl-12 pr-4 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-surface focus:ring-4 focus:ring-leaf-300/40"
                placeholder="Enter a new password"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-bold text-forest-700">
              Confirm new password
            </label>
            <div className="relative mt-2">
              <Lock
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline"
                strokeWidth={2}
              />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="crop-touch w-full rounded-md border border-stroke bg-surface-2 pl-12 pr-4 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-surface focus:ring-4 focus:ring-leaf-300/40"
                placeholder="Re-enter your new password"
              />
            </div>
          </div>

          {error ? <ErrorMessage message={error} /> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="crop-touch inline-flex w-full items-center justify-center rounded-md bg-lime px-6 text-base font-bold text-forest-900 shadow-sm transition hover:bg-lime-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline disabled:shadow-none"
          >
            {isSubmitting ? 'Resetting…' : 'Reset password'}
          </button>

          <button
            type="button"
            disabled={!canResendCode}
            onClick={handleResendCode}
            className="crop-touch inline-flex w-full items-center justify-center rounded-md border border-stroke bg-surface px-6 text-sm font-bold text-forest-700 transition hover:border-leaf-700 hover:bg-canvas disabled:cursor-not-allowed disabled:text-outline"
          >
            {isResending
              ? 'Sending new code…'
              : resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend code'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsCodeSent(false)
              setDebugOtp('')
              setSuccess('')
              setError('')
              setResendCooldown(0)
            }}
            className="crop-touch inline-flex w-full items-center justify-center rounded-md border border-stroke bg-surface-2 px-6 text-sm font-bold text-muted transition hover:bg-canvas"
          >
            Use a different email
          </button>
        </form>
      )}

      <Link
        to="/login"
        className="mt-8 inline-flex w-full items-center justify-center gap-2 text-sm font-bold text-leaf-700 hover:text-forest-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Return to Login
      </Link>
    </section>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md bg-red-50 px-4 py-3 text-sm font-bold text-danger ring-1 ring-red-200"
    >
      {message}
    </p>
  )
}

export default ForgotPassword
