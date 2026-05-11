export type DiseaseInfo = {
  label: string
  explanation: string
}

export type DiseaseDisplaySource = {
  className?: string
  rawDiseaseLabel?: string
  disease?: string
  diseaseFriendlyName?: string
  diseaseExplanation?: string
}

export const PLANTVILLAGE_DISEASE_EXPLANATIONS: Record<string, DiseaseInfo> = {
  Apple___Apple_scab: {
    label: 'Apple Scab',
    explanation: 'Olive-brown leaf or fruit spots caused by a fungal infection.',
  },
  Apple___Black_rot: {
    label: 'Black Rot',
    explanation: 'Dark leaf spots and fruit rot caused by a fungal infection.',
  },
  Apple___Cedar_apple_rust: {
    label: 'Cedar Apple Rust',
    explanation: 'Orange rust spots linked to a fungus that cycles between apple and cedar.',
  },
  Apple___healthy: {
    label: 'Healthy',
    explanation: 'Apple leaf looks healthy with no obvious disease pattern.',
  },
  Blueberry___healthy: {
    label: 'Healthy',
    explanation: 'Blueberry leaf looks healthy with no obvious disease pattern.',
  },
  'Cherry_(including_sour)___Powdery_mildew': {
    label: 'Powdery Mildew',
    explanation: 'White powdery fungal growth on cherry leaves.',
  },
  'Cherry_(including_sour)___healthy': {
    label: 'Healthy',
    explanation: 'Cherry leaf looks healthy with no obvious disease pattern.',
  },
  'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot': {
    label: 'Cercospora Leaf Spot (Gray Leaf Spot)',
    explanation: 'Gray or tan rectangular corn leaf spots caused by a fungal infection.',
  },
  'Corn_(maize)___Common_rust_': {
    label: 'Common Rust',
    explanation: 'Rust-colored pustules on corn leaves caused by a fungal infection.',
  },
  'Corn_(maize)___Northern_Leaf_Blight': {
    label: 'Northern Leaf Blight',
    explanation: 'Long cigar-shaped corn leaf lesions caused by a fungal infection.',
  },
  'Corn_(maize)___healthy': {
    label: 'Healthy',
    explanation: 'Corn leaf looks healthy with no obvious disease pattern.',
  },
  Grape___Black_rot: {
    label: 'Black Rot',
    explanation: 'Brown leaf spots and shriveled fruit caused by a fungal infection.',
  },
  'Grape___Esca_(Black_Measles)': {
    label: 'Esca (Black Measles)',
    explanation: 'Grape vine disease that can cause striped leaves and dark fruit spotting.',
  },
  'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)': {
    label: 'Leaf Blight (Isariopsis Leaf Spot)',
    explanation: 'Brown grape leaf spots and blighted patches caused by fungal infection.',
  },
  Grape___healthy: {
    label: 'Healthy',
    explanation: 'Grape leaf looks healthy with no obvious disease pattern.',
  },
  'Orange___Haunglongbing_(Citrus_greening)': {
    label: 'Huanglongbing (Citrus Greening)',
    explanation: 'Serious citrus disease that causes yellow mottled leaves and poor fruit.',
  },
  Peach___Bacterial_spot: {
    label: 'Bacterial Spot',
    explanation: 'Small dark peach leaf spots caused by bacterial infection.',
  },
  Peach___healthy: {
    label: 'Healthy',
    explanation: 'Peach leaf looks healthy with no obvious disease pattern.',
  },
  Pepper__bell___Bacterial_spot: {
    label: 'Bacterial Spot',
    explanation: 'Water-soaked or dark bell pepper leaf spots caused by bacteria.',
  },
  Pepper__bell___healthy: {
    label: 'Healthy',
    explanation: 'Bell pepper leaf looks healthy with no obvious disease pattern.',
  },
  Potato___Early_blight: {
    label: 'Early Blight',
    explanation: 'Brown target-like potato leaf spots caused by fungal infection.',
  },
  Potato___Late_blight: {
    label: 'Late Blight',
    explanation: 'Fast-spreading dark, water-soaked potato lesions caused by blight.',
  },
  Potato___healthy: {
    label: 'Healthy',
    explanation: 'Potato leaf looks healthy with no obvious disease pattern.',
  },
  Raspberry___healthy: {
    label: 'Healthy',
    explanation: 'Raspberry leaf looks healthy with no obvious disease pattern.',
  },
  Soybean___healthy: {
    label: 'Healthy',
    explanation: 'Soybean leaf looks healthy with no obvious disease pattern.',
  },
  Squash___Powdery_mildew: {
    label: 'Powdery Mildew',
    explanation: 'White powdery fungal patches on squash leaves.',
  },
  Strawberry___Leaf_scorch: {
    label: 'Leaf Scorch',
    explanation: 'Purple-brown strawberry leaf spots that can make leaves look burned.',
  },
  Strawberry___healthy: {
    label: 'Healthy',
    explanation: 'Strawberry leaf looks healthy with no obvious disease pattern.',
  },
  Tomato_Bacterial_spot: {
    label: 'Bacterial Spot',
    explanation: 'Small dark tomato leaf spots caused by bacterial infection.',
  },
  Tomato_Early_blight: {
    label: 'Early Blight',
    explanation: 'Brown target-like tomato leaf spots caused by fungal infection.',
  },
  Tomato_Late_blight: {
    label: 'Late Blight',
    explanation: 'Fast-spreading dark tomato lesions caused by blight.',
  },
  Tomato_Leaf_Mold: {
    label: 'Leaf Mold',
    explanation: 'Yellow leaf patches with fuzzy mold growth, often in humid conditions.',
  },
  Tomato_Septoria_leaf_spot: {
    label: 'Septoria Leaf Spot',
    explanation: 'Many small round tomato leaf spots caused by fungal infection.',
  },
  Tomato_Spider_mites_Two_spotted_spider_mite: {
    label: 'Two-Spotted Spider Mite',
    explanation: 'Tiny mites causing speckled, bronzed, or webbed tomato leaves.',
  },
  Tomato__Target_Spot: {
    label: 'Target Spot',
    explanation: 'Brown target-like tomato leaf spots caused by fungal infection.',
  },
  Tomato__Tomato_YellowLeaf__Curl_Virus: {
    label: 'Tomato Yellow Leaf Curl Virus',
    explanation: 'Virus that causes curled yellow tomato leaves and stunted growth.',
  },
  Tomato__Tomato_mosaic_virus: {
    label: 'Tomato Mosaic Virus',
    explanation: 'Virus that causes mottled, distorted, or curled tomato leaves.',
  },
  Tomato_healthy: {
    label: 'Healthy',
    explanation: 'Tomato leaf looks healthy with no obvious disease pattern.',
  },
}

const INFO_BY_LABEL = Object.values(PLANTVILLAGE_DISEASE_EXPLANATIONS).reduce<
  Record<string, DiseaseInfo>
>((lookup, info) => {
  lookup[normalizeDiseaseLabel(info.label)] = info
  return lookup
}, {})

export function getDiseaseInfo(className?: string, disease?: string): DiseaseInfo {
  if (className && PLANTVILLAGE_DISEASE_EXPLANATIONS[className]) {
    return PLANTVILLAGE_DISEASE_EXPLANATIONS[className]
  }

  if (disease) {
    const byDisease = INFO_BY_LABEL[normalizeDiseaseLabel(disease)]
    if (byDisease) return byDisease
  }

  return {
    label: disease || 'Unknown condition',
    explanation: 'CropScan could not match this label to a PlantVillage disease class.',
  }
}

export function formatDiseaseWithExplanation(
  className?: string,
  disease?: string,
) {
  const info = getDiseaseInfo(className, disease)
  return `${info.label} (${info.explanation})`
}

export function getDiseaseDisplay(source: DiseaseDisplaySource) {
  const fallback = getDiseaseInfo(
    source.rawDiseaseLabel || source.className,
    source.disease,
  )
  return {
    friendlyName: source.diseaseFriendlyName || fallback.label,
    rawLabel: source.rawDiseaseLabel || source.className || source.disease || '',
    explanation: source.diseaseExplanation || fallback.explanation,
  }
}

function normalizeDiseaseLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
