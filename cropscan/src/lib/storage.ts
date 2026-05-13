import type { AnalysisRecord, UserProfile } from '../types'

export const AUTH_TOKEN_KEY = 'cropscan_jwt'
export const AUTH_USER_KEY = 'cropscan_user'
export const ANALYSIS_HISTORY_KEY = 'cropscan_analysis_history'

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

export function saveAnalysis(record: AnalysisRecord) {
  const rawHistory = localStorage.getItem(ANALYSIS_HISTORY_KEY)
  let history: AnalysisRecord[] = []

  if (rawHistory) {
    try {
      const parsed = JSON.parse(rawHistory)
      if (Array.isArray(parsed)) history = parsed as AnalysisRecord[]
    } catch {
      history = []
    }
  }

  const nextHistory = [
    record,
    ...history.filter((existingRecord) => existingRecord.id !== record.id),
  ].slice(0, 50)

  localStorage.setItem(ANALYSIS_HISTORY_KEY, JSON.stringify(nextHistory))
}
