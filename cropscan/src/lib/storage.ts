import type { UserProfile } from '../types'

export const AUTH_TOKEN_KEY = 'cropscan_jwt'
export const AUTH_USER_KEY = 'cropscan_user'

export function readStoredUser() {
  const rawUser = localStorage.getItem(AUTH_USER_KEY)
  if (!rawUser) return null

  try {
    return JSON.parse(rawUser) as UserProfile
  } catch {
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}
