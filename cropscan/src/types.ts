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
