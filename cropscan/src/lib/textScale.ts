// Global text-size control. Interview feedback (Anne) flagged that small
// description text under titles was hard to read, and several users wanted
// better accessibility. We scale the root html font-size; because the app's
// styles are rem-based, everything scales proportionally.

export type TextScaleId = 'default' | 'large' | 'larger'

export type TextScaleOption = {
  id: TextScaleId
  label: string
  scale: number
}

export const TEXT_SCALE_KEY = 'cropscan_text_scale'

export const TEXT_SCALE_OPTIONS: TextScaleOption[] = [
  { id: 'default', label: 'Default', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.125 },
  { id: 'larger', label: 'Larger', scale: 1.25 },
]

const DEFAULT_OPTION = TEXT_SCALE_OPTIONS[0]

export function getTextScaleOption(id: string | null | undefined): TextScaleOption {
  return TEXT_SCALE_OPTIONS.find((option) => option.id === id) ?? DEFAULT_OPTION
}

export function getSavedTextScaleId(): TextScaleId {
  try {
    return getTextScaleOption(localStorage.getItem(TEXT_SCALE_KEY)).id
  } catch {
    return DEFAULT_OPTION.id
  }
}

/** Apply a scale to the document root. Safe to call before React mounts. */
export function applyTextScale(id: string | null | undefined): TextScaleId {
  const option = getTextScaleOption(id)
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.fontSize = `${Math.round(option.scale * 100)}%`
  }
  return option.id
}

/** Persist + apply. Returns the resolved id. */
export function setTextScale(id: string | null | undefined): TextScaleId {
  const resolved = applyTextScale(id)
  try {
    localStorage.setItem(TEXT_SCALE_KEY, resolved)
  } catch {
    // ignore storage failures (private mode, quota)
  }
  return resolved
}
