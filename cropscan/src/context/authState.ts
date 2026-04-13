import { createContext } from 'react'
import type { UserProfile } from '../types'

export type AuthContextValue = {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string) => void
  signup: (profile: UserProfile) => void
  logout: () => void
  updateProfile: (profile: UserProfile) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
