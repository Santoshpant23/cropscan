import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
import { useAuth } from '../context/useAuth'
import type { UserProfile } from '../types'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function SignUp() {
  const { isAuthenticated, signup } = useAuth()
  const navigate = useNavigate()
  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isPasswordStrong = formValues.password.length >= 8
  const isEmailValid = emailPattern.test(formValues.email.trim())
  const isNameValid = formValues.name.trim().length >= 2
  const doesPasswordMatch =
    formValues.confirm.length > 0 && formValues.password === formValues.confirm
  const isFormValid =
    isNameValid && isEmailValid && isPasswordStrong && doesPasswordMatch

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
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
      setError('Please complete every field before continuing.')
      return
    }

    const profile: UserProfile = {
      name: formValues.name.trim(),
      email: formValues.email.trim(),
      role: 'Smallholder farmer',
      location: '',
    }
    setIsSubmitting(true)
    try {
      await signup(profile, formValues.password)
      navigate('/', { replace: true })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Signup failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthenticated) return <Navigate to="/" replace />

  return (
    <section className="mx-auto w-full max-w-md px-6 pb-12 pt-6 sm:pt-10 lg:max-w-lg lg:pt-16">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl">
          Create your account
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Save scans, review cases, and keep field notes in one place.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field
          id="name"
          name="name"
          label="Full name"
          icon={User}
          autoComplete="name"
          placeholder="Avery Johnson"
          value={formValues.name}
          onChange={handleChange}
          error={
            formValues.name.length > 0 && !isNameValid
              ? 'Enter at least 2 characters for your name.'
              : ''
          }
        />

        <Field
          id="email"
          name="email"
          type="email"
          label="Email address"
          icon={Mail}
          autoComplete="email"
          placeholder="farmer@example.com"
          value={formValues.email}
          onChange={handleChange}
          error={
            formValues.email.length > 0 && !isEmailValid
              ? 'Enter a valid email address.'
              : ''
          }
        />

        <div>
          <label htmlFor="password" className="block text-sm font-bold text-forest-700">
            Password
          </label>
          <div className="relative mt-2">
            <Lock
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline"
              strokeWidth={2}
            />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={formValues.password}
              onChange={handleChange}
              className="crop-touch w-full rounded-md border border-stroke bg-surface-2 pl-12 pr-12 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-surface focus:ring-4 focus:ring-leaf-300/40"
              placeholder="Create a password"
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
          <p className="mt-2 text-xs font-medium text-muted">
            Use a password you can remember outdoors. Minimum 8 characters.
          </p>
        </div>

        <Field
          id="confirm"
          name="confirm"
          type={showPassword ? 'text' : 'password'}
          label="Confirm password"
          icon={Lock}
          autoComplete="new-password"
          placeholder="Repeat password"
          value={formValues.confirm}
          onChange={handleChange}
          error={
            formValues.confirm.length > 0 && !doesPasswordMatch
              ? 'Passwords must match exactly.'
              : ''
          }
        />

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
          disabled={isSubmitting || !isFormValid}
          className="crop-touch inline-flex w-full items-center justify-center gap-2 rounded-md bg-lime px-6 text-base font-bold tracking-tight text-forest-900 shadow-sm transition hover:bg-lime-soft active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-outline disabled:shadow-none"
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
          {!isSubmitting ? <ArrowRight className="h-5 w-5" strokeWidth={2.5} /> : null}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-leaf-700 hover:text-forest-900">
          Login
        </Link>
      </p>
    </section>
  )
}

type FieldProps = {
  id: string
  name: string
  label: string
  icon: typeof User
  type?: string
  autoComplete?: string
  placeholder?: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  error?: string
}

function Field({
  id,
  name,
  label,
  icon: Icon,
  type = 'text',
  autoComplete,
  placeholder,
  value,
  onChange,
  error,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-forest-700">
        {label}
      </label>
      <div className="relative mt-2">
        <Icon
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-outline"
          strokeWidth={2}
        />
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={onChange}
          className="crop-touch w-full rounded-md border border-stroke bg-surface-2 pl-12 pr-4 text-base text-forest-900 outline-none transition focus:border-leaf-700 focus:bg-surface focus:ring-4 focus:ring-leaf-300/40"
          placeholder={placeholder}
        />
      </div>
      {error ? (
        <p className="mt-2 text-xs font-bold text-danger">{error}</p>
      ) : null}
    </div>
  )
}

export default SignUp
