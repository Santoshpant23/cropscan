import { describe, expect, it } from 'vitest'
import {
  SUPPORTED_CROPS,
  SUPPORTED_CROP_NAMES,
  TOTAL_SUPPORTED_CLASSES,
  normalizeCropName,
  cropsMatch,
  isSupportedCrop,
} from './supportedCrops'

describe('supportedCrops data', () => {
  it('has the 14 canonical crop groups', () => {
    expect(SUPPORTED_CROPS).toHaveLength(14)
    expect(SUPPORTED_CROP_NAMES).toContain('Tomato')
    expect(SUPPORTED_CROP_NAMES).toContain('Bell pepper')
  })

  it('matches the backend total of 38 disease classes', () => {
    expect(TOTAL_SUPPORTED_CLASSES).toBe(38)
  })

  it('has no duplicate crop names', () => {
    expect(new Set(SUPPORTED_CROP_NAMES).size).toBe(SUPPORTED_CROP_NAMES.length)
  })
})

describe('normalizeCropName', () => {
  it('returns the canonical name for an exact match', () => {
    expect(normalizeCropName('Tomato')).toBe('Tomato')
  })

  it('is case-insensitive', () => {
    expect(normalizeCropName('tomato')).toBe('Tomato')
    expect(normalizeCropName('TOMATO')).toBe('Tomato')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeCropName('  Tomato  ')).toBe('Tomato')
  })

  it('handles the multi-word crop "Bell pepper"', () => {
    expect(normalizeCropName('bell pepper')).toBe('Bell pepper')
    expect(normalizeCropName('  BELL PEPPER ')).toBe('Bell pepper')
  })

  it('returns null for unsupported crops', () => {
    expect(normalizeCropName('Kale')).toBeNull()
    expect(normalizeCropName('Rhubarb')).toBeNull()
    expect(normalizeCropName('Dandelion')).toBeNull()
  })

  it('returns null for empty / nullish / non-string input', () => {
    expect(normalizeCropName('')).toBeNull()
    expect(normalizeCropName('   ')).toBeNull()
    expect(normalizeCropName(null)).toBeNull()
    expect(normalizeCropName(undefined)).toBeNull()
    // @ts-expect-error exercising a wrong runtime type on purpose
    expect(normalizeCropName(42)).toBeNull()
  })
})

describe('cropsMatch', () => {
  it('matches same crop regardless of case/whitespace', () => {
    expect(cropsMatch('Tomato', 'tomato')).toBe(true)
    expect(cropsMatch(' Bell Pepper ', 'bell pepper')).toBe(true)
  })

  it('does not match different crops', () => {
    expect(cropsMatch('Tomato', 'Corn')).toBe(false)
    expect(cropsMatch('Apple', 'Potato')).toBe(false)
  })

  it('never matches when either side is unsupported or empty', () => {
    expect(cropsMatch('Kale', 'Corn')).toBe(false)
    expect(cropsMatch('Tomato', 'Kale')).toBe(false)
    expect(cropsMatch('', 'Tomato')).toBe(false)
    expect(cropsMatch(null, 'Tomato')).toBe(false)
    expect(cropsMatch('Tomato', undefined)).toBe(false)
    expect(cropsMatch(null, null)).toBe(false)
  })
})

describe('isSupportedCrop', () => {
  it('is true for supported crops and false otherwise', () => {
    expect(isSupportedCrop('Corn')).toBe(true)
    expect(isSupportedCrop('corn')).toBe(true)
    expect(isSupportedCrop('Kale')).toBe(false)
    expect(isSupportedCrop(null)).toBe(false)
  })
})
