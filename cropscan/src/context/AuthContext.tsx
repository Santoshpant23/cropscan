import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  createMockJwt,
  migrateUserAnalysesEmail,
  readStoredUser,
} from '../lib/storage'
import type { UserProfile } from '../types'
import { AuthContext } from './authState'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY))
  const [user, setUser] = useState<UserProfile | null>(() => readStoredUser())

  function persistSession(nextUser: UserProfile) {
    const nextToken = createMockJwt(nextUser.email)
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
  }

  function login(email: string) {
    const storedUser = readStoredUser()
    persistSession(
      storedUser?.email === email
        ? storedUser
        : {
            name: 'CropScan User',
            email,
            role: 'Smallholder farmer',
            location: 'Knox County, TN',
          },
    )
  }

  function signup(profile: UserProfile) {
    persistSession(profile)
  }

  function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  function updateProfile(profile: UserProfile) {
    if (user?.email && user.email !== profile.email) {
      migrateUserAnalysesEmail(user.email, profile.email)
    }
    const nextToken = createMockJwt(profile.email)
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken)
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile))
    setToken(nextToken)
    setUser(profile)
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
