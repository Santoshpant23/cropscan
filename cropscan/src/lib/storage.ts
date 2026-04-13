import type { AnalysisRecord, UserProfile } from '../types'

export const AUTH_TOKEN_KEY = 'cropscan_jwt'
export const AUTH_USER_KEY = 'cropscan_user'
export const ANALYSES_KEY = 'cropscan_analyses'

export function createMockJwt(email: string) {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(
    JSON.stringify({
      sub: email,
      name: 'CropScan frontend token',
      iat: Math.floor(Date.now() / 1000),
    }),
  )

  // Frontend-only placeholder. Replace with the FastAPI-issued JWT later.
  return `${header}.${payload}.mock-signature`
}

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

export function readAnalyses() {
  const rawAnalyses = localStorage.getItem(ANALYSES_KEY)
  if (!rawAnalyses) return []

  try {
    return JSON.parse(rawAnalyses) as AnalysisRecord[]
  } catch {
    localStorage.removeItem(ANALYSES_KEY)
    return []
  }
}

export function writeAnalyses(records: AnalysisRecord[]) {
  localStorage.setItem(ANALYSES_KEY, JSON.stringify(records))
}

export function getUserAnalyses(email: string) {
  return readAnalyses().filter((record) => record.userEmail === email)
}

export function saveAnalysis(record: AnalysisRecord) {
  const existingRecords = readAnalyses()
  writeAnalyses([record, ...existingRecords])
}

export function updateAnalysisNotes(id: string, notes: string) {
  const nextRecords = readAnalyses().map((record) =>
    record.id === id ? { ...record, notes } : record,
  )
  writeAnalyses(nextRecords)
}

export function deleteAnalysis(id: string) {
  writeAnalyses(readAnalyses().filter((record) => record.id !== id))
}

export function clearUserAnalyses(email: string) {
  writeAnalyses(readAnalyses().filter((record) => record.userEmail !== email))
}

export function migrateUserAnalysesEmail(previousEmail: string, nextEmail: string) {
  const nextRecords = readAnalyses().map((record) =>
    record.userEmail === previousEmail ? { ...record, userEmail: nextEmail } : record,
  )
  writeAnalyses(nextRecords)
}
