import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import type { UserProfile } from '../types'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getPasswordChecks(password: string) {
  return [
    {
      label: 'At least 8 characters',
      isValid: password.length >= 8,
    },
    {
      label: 'One uppercase letter',
      isValid: /[A-Z]/.test(password),
    },
    {
      label: 'One lowercase letter',
      isValid: /[a-z]/.test(password),
    },
    {
      label: 'One number',
      isValid: /\d/.test(password),
    },
    {
      label: 'One special character',
      isValid: /[^A-Za-z0-9]/.test(password),
    },
  ]
}

function SignUp() {
  const { isAuthenticated, signup } = useAuth()
  const navigate = useNavigate()
  const [formValues, setFormValues] = useState({
    name: '',
    role: 'Smallholder farmer',
    email: '',
    location: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const passwordChecks = getPasswordChecks(formValues.password)
  const isPasswordValid = passwordChecks.every((check) => check.isValid)
  const isEmailValid = emailPattern.test(formValues.email.trim())
  const isNameValid = formValues.name.trim().length >= 2
  const doesPasswordMatch =
    formValues.confirm.length > 0 && formValues.password === formValues.confirm
  const isFormValid =
    isNameValid &&
    isEmailValid &&
    isPasswordValid &&
    doesPasswordMatch

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }))
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!isFormValid) {
      setError('Please complete all signup requirements before continuing.')
      return
    }

    const profile: UserProfile = {
      name: formValues.name.trim(),
      email: formValues.email.trim(),
      role: formValues.role,
      location: formValues.location.trim() || 'Knox County, TN',
    }
    setIsSubmitting(true)
    try {
      await signup(profile, formValues.password)
      navigate('/scan', { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Signup failed.')
    } finally {
      setIsSubmitting(false)
    }
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
              value={formValues.name}
              onChange={handleChange}
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="Avery Johnson"
            />
            {formValues.name.length > 0 && !isNameValid && (
              <p className="mt-2 text-xs font-bold text-[#be123c]">
                Enter at least 2 characters for your name.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="role" className="text-sm font-black text-[#16351f]">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formValues.role}
              onChange={handleChange}
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
              value={formValues.email}
              onChange={handleChange}
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="farmer@example.com"
            />
            {formValues.email.length > 0 && !isEmailValid && (
              <p className="mt-2 text-xs font-bold text-[#be123c]">
                Enter a valid email address.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="location" className="text-sm font-black text-[#16351f]">
              Location
            </label>
            <input
              id="location"
              name="location"
              type="text"
              value={formValues.location}
              onChange={handleChange}
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
              value={formValues.password}
              onChange={handleChange}
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
              value={formValues.confirm}
              onChange={handleChange}
              className="mt-2 w-full rounded-md border border-[#14532d]/15 bg-white px-4 py-3 text-[#16351f] outline-none transition focus:border-[#22c55e] focus:ring-4 focus:ring-[#bbf7d0]"
              placeholder="Repeat password"
            />
            {formValues.confirm.length > 0 && !doesPasswordMatch && (
              <p className="mt-2 text-xs font-bold text-[#be123c]">
                Passwords must match exactly.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <div className="rounded-md bg-[#f0fdf4] p-3 ring-1 ring-[#bbf7d0]">
              <p className="text-xs font-black uppercase text-[#166534]">
                Password requirements
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {passwordChecks.map((check) => (
                  <p
                    key={check.label}
                    className={`flex items-center gap-2 text-xs font-bold ${
                      check.isValid ? 'text-[#166534]' : 'text-[#be123c]'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                        check.isValid
                          ? 'bg-[#dcfce7] text-[#166534] ring-1 ring-[#86efac]'
                          : 'bg-[#fee2e2] text-[#be123c] ring-1 ring-[#fda4af]'
                      }`}
                    >
                      {check.isValid ? '✓' : '✕'}
                    </span>
                    <span>{check.label}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className="cursor-pointer rounded-md bg-[#f97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#a8b3aa] sm:col-span-2"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-md bg-[#fff1f2] px-4 py-3 text-sm font-bold text-[#be123c] ring-1 ring-[#fecdd3]">
            {error}
          </p>
        )}

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
