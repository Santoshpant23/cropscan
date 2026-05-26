// Single source of truth for the crops CropScan's model can diagnose.
// Crop display names here MUST match what the backend produces for a
// prediction's `crop` field (see backend/app/inference.py _class_to_crop):
// Apple, Blueberry, Cherry, Corn, Grape, Orange, Peach, Bell pepper,
// Potato, Raspberry, Soybean, Squash, Strawberry, Tomato.

export type SupportedCrop = {
  name: string
  classes: string[]
}

export const SUPPORTED_CROPS: SupportedCrop[] = [
  { name: 'Apple', classes: ['Apple Scab', 'Black Rot', 'Cedar Apple Rust', 'Healthy'] },
  { name: 'Blueberry', classes: ['Healthy'] },
  { name: 'Cherry', classes: ['Powdery Mildew', 'Healthy'] },
  {
    name: 'Corn',
    classes: [
      'Cercospora Leaf Spot / Gray Leaf Spot',
      'Common Rust',
      'Northern Leaf Blight',
      'Healthy',
    ],
  },
  {
    name: 'Grape',
    classes: ['Black Rot', 'Esca (Black Measles)', 'Leaf Blight (Isariopsis Leaf Spot)', 'Healthy'],
  },
  { name: 'Orange', classes: ['Huanglongbing (Citrus Greening)'] },
  { name: 'Peach', classes: ['Bacterial Spot', 'Healthy'] },
  { name: 'Bell pepper', classes: ['Bacterial Spot', 'Healthy'] },
  { name: 'Potato', classes: ['Early Blight', 'Late Blight', 'Healthy'] },
  { name: 'Raspberry', classes: ['Healthy'] },
  { name: 'Soybean', classes: ['Healthy'] },
  { name: 'Squash', classes: ['Powdery Mildew'] },
  { name: 'Strawberry', classes: ['Leaf Scorch', 'Healthy'] },
  {
    name: 'Tomato',
    classes: [
      'Bacterial Spot',
      'Early Blight',
      'Late Blight',
      'Leaf Mold',
      'Septoria Leaf Spot',
      'Spider Mites Two Spotted Spider Mite',
      'Target Spot',
      'Tomato Yellow Leaf Curl Virus',
      'Tomato Mosaic Virus',
      'Healthy',
    ],
  },
]

export const SUPPORTED_CROP_NAMES: string[] = SUPPORTED_CROPS.map((crop) => crop.name)

export const TOTAL_SUPPORTED_CLASSES: number = SUPPORTED_CROPS.reduce(
  (sum, crop) => sum + crop.classes.length,
  0,
)

/**
 * Map an arbitrary crop string (e.g. a prediction's `crop`, or a saved
 * selection) to its canonical supported-crop name, or null if it is not a
 * crop CropScan supports. Case- and whitespace-insensitive.
 */
export function normalizeCropName(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return null
  const match = SUPPORTED_CROPS.find((crop) => crop.name.toLowerCase() === trimmed)
  return match ? match.name : null
}

/** True only when both crops resolve to the same supported crop. */
export function cropsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeCropName(a)
  const right = normalizeCropName(b)
  if (!left || !right) return false
  return left === right
}

/** Whether a crop string is one CropScan supports. */
export function isSupportedCrop(value: string | null | undefined): boolean {
  return normalizeCropName(value) !== null
}
