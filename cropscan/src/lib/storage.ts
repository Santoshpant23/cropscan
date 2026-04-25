import type { AnalysisRecord, UserProfile } from '../types'

export const AUTH_TOKEN_KEY = 'cropscan_jwt'
export const AUTH_USER_KEY = 'cropscan_user'
export const ANALYSES_KEY = 'cropscan_analyses'

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

function getAnalysisKey(record: AnalysisRecord) {
  return `${record.userEmail}::${record.imageDataUrl}`
}

function dedupeAnalyses(records: AnalysisRecord[]) {
  const seenKeys = new Set<string>()
  const uniqueRecords: AnalysisRecord[] = []

  for (const record of records) {
    const key = getAnalysisKey(record)
    if (seenKeys.has(key)) continue

    seenKeys.add(key)
    uniqueRecords.push(record)
  }

  return uniqueRecords
}

export function getUserAnalyses(email: string) {
  const records = readAnalyses()
  const uniqueRecords = dedupeAnalyses(records)

  if (uniqueRecords.length !== records.length) {
    writeAnalyses(uniqueRecords)
  }

  return uniqueRecords.filter((record) => record.userEmail === email)
}

export function saveAnalysis(record: AnalysisRecord) {
  const existingRecords = readAnalyses()
  const recordsWithoutSameImage = existingRecords.filter(
    (existingRecord) => getAnalysisKey(existingRecord) !== getAnalysisKey(record),
  )

  writeAnalyses([record, ...recordsWithoutSameImage])
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
