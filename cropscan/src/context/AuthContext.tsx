import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  migrateUserAnalysesEmail,
  readStoredUser,
} from '../lib/storage'
import {
  loginRequest,
  signupRequest,
  updateProfileRequest,
} from '../lib/api'
import type { UserProfile } from '../types'
import { AuthContext } from './authState'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY))
  const [user, setUser] = useState<UserProfile | null>(() => readStoredUser())

  function persistSession(nextUser: UserProfile, nextToken: string) {
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
  }

  async function login(email: string, password: string) {
    const session = await loginRequest(email, password)
    persistSession(session.user, session.token)
  }

  async function signup(profile: UserProfile, password: string) {
    const session = await signupRequest(profile, password)
    persistSession(session.user, session.token)
  }

  function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  async function updateProfile(profile: UserProfile) {
    if (!token) return
    const updatedProfile = await updateProfileRequest(profile, token)
    if (user?.email && user.email !== updatedProfile.email) {
      migrateUserAnalysesEmail(user.email, updatedProfile.email)
    }
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedProfile))
    setUser(updatedProfile)
  }

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    login,
    signup,
    logout,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
