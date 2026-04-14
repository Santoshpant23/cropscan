import { createContext } from 'react'
import type { UserProfile } from '../types'

export type AuthContextValue = {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (profile: UserProfile, password: string) => Promise<void>
  logout: () => void
  updateProfile: (profile: UserProfile) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
