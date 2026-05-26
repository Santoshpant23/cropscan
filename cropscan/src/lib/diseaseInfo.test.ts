import { describe, expect, it } from 'vitest'
import {
  PLANTVILLAGE_DISEASE_EXPLANATIONS,
  getDiseaseInfo,
  normalizeDiseaseLabel,
} from './diseaseInfo'

describe('PLANTVILLAGE_DISEASE_EXPLANATIONS', () => {
  it('covers all 38 backend classes', () => {
    expect(Object.keys(PLANTVILLAGE_DISEASE_EXPLANATIONS)).toHaveLength(38)
  })

  it('every entry has a non-empty label and explanation', () => {
    for (const info of Object.values(PLANTVILLAGE_DISEASE_EXPLANATIONS)) {
      expect(info.label.length).toBeGreaterThan(0)
      expect(info.explanation.length).toBeGreaterThan(0)
    }
  })
})

describe('getDiseaseInfo', () => {
  it('resolves by exact backend className', () => {
    const info = getDiseaseInfo('Tomato_Late_blight')
    expect(info?.label).toBe('Late Blight')
    expect(info?.scientificName).toBe('Phytophthora infestans')
  })

  it('resolves the awkward corn cercospora class (Yusei could not understand it)', () => {
    const info = getDiseaseInfo(
      'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
    )
    expect(info?.label).toContain('Cercospora')
    expect(info?.explanation.toLowerCase()).toContain('corn')
  })

  it('falls back to the friendly display label when className is unknown', () => {
    const info = getDiseaseInfo('Not_A_Real_Class', 'Late Blight')
    expect(info?.label).toBe('Late Blight')
  })

  it('label fallback is case/punctuation insensitive', () => {
    expect(getDiseaseInfo(undefined, 'late blight')?.label).toBe('Late Blight')
    expect(getDiseaseInfo(undefined, 'CEDAR APPLE RUST')?.label).toBe(
      'Cedar Apple Rust',
    )
  })

  it('returns null when nothing matches', () => {
    expect(getDiseaseInfo('Nope', 'Totally Unknown Condition')).toBeNull()
    expect(getDiseaseInfo(undefined, undefined)).toBeNull()
    expect(getDiseaseInfo(null, null)).toBeNull()
    expect(getDiseaseInfo('', '')).toBeNull()
  })

  it('resolves Healthy classes', () => {
    expect(getDiseaseInfo('Tomato_healthy')?.label).toBe('Healthy')
    expect(getDiseaseInfo('Apple___healthy')?.label).toBe('Healthy')
  })
})

describe('normalizeDiseaseLabel', () => {
  it('collapses punctuation and whitespace', () => {
    expect(normalizeDiseaseLabel('Esca (Black Measles)')).toBe('esca black measles')
    expect(normalizeDiseaseLabel('  Late   Blight  ')).toBe('late blight')
  })
})
