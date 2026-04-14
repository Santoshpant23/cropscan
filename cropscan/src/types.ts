export type UserProfile = {
  name: string
  email: string
  role: string
  location: string
}

export type ModelPrediction = {
  modelName: 'EfficientNet-B0' | 'MobileNetV2'
  crop: string
  disease: string
  confidence: number
  className?: string
  topK?: Array<{
    className: string
    crop: string
    disease: string
    confidence: number
  }>
}

export type AnalysisRecord = {
  id: string
  userEmail: string
  createdAt: string
  fileName: string
  imageDataUrl: string
  status: 'High confidence' | 'Review needed'
  recommendation: string
  notes: string
  predictions: ModelPrediction[]
}

export type AuthUserResponse = {
  id: string
  full_name: string
  email: string
  role?: string
  location?: string
}

export type UploadResponse = {
  fileName: string
  cropType: string
  condition: string
  confidenceScore: number
  confidencePercent: number
  status: 'High confidence' | 'Review needed'
  recommendation: string
  predictions: Array<{
    modelName: 'EfficientNet-B0' | 'MobileNetV2'
    crop: string
    disease: string
    className: string
    confidence: number
    confidencePercent: number
    topK: Array<{
      className: string
      crop: string
      disease: string
      confidence: number
      confidencePercent: number
    }>
  }>
}
