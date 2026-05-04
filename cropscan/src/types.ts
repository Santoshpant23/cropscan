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

export type RecommendationDetails = {
  headline: string
  urgency: 'low' | 'medium' | 'high'
  overview: string
  immediateSteps: string[]
  productCategories: string[]
  cautions: string[]
  followUp: string
}

export type AnalysisRecord = {
  id: string
  userEmail: string
  createdAt: string
  fileName: string
  imageDataUrl: string
  cropType?: string
  condition?: string
  confidencePercent?: number
  status: 'High confidence' | 'Review needed'
  recommendation: string
  recommendationDetails?: RecommendationDetails
  notes: string
  predictions: ModelPrediction[]
}

export type ScanResponse = {
  id: string
  user_id: string
  timestamp: string
  image_filename: string
  predictions: Array<{
    modelName: 'EfficientNet-B0' | 'MobileNetV2'
    crop: string
    disease: string
    className?: string
    confidence: number
    confidencePercent?: number
    topK?: Array<{
      className: string
      crop: string
      disease: string
      confidence: number
      confidencePercent?: number
    }>
  }>
  recommendation: string
  recommendation_details?: RecommendationDetails
  disease_label: string
  crop_type?: string
  confidence_percent?: number
  status: 'High confidence' | 'Review needed'
}

export type AuthUserResponse = {
  id: string
  full_name: string
  email: string
  role?: string
  location?: string
}

export type UploadResponse = {
  scanId?: string
  fileName: string
  cropType: string
  condition: string
  confidenceScore: number
  confidencePercent: number
  status: 'High confidence' | 'Review needed'
  recommendation: string
  recommendationDetails: RecommendationDetails
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

export type DiagnosisChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type DiagnosisChatRequest = {
  analysis: {
    cropType: string
    condition: string
    confidencePercent: number
    status: 'High confidence' | 'Review needed'
    recommendation: string
    recommendationDetails: RecommendationDetails
    predictions: Array<{
      modelName: 'EfficientNet-B0' | 'MobileNetV2'
      crop: string
      disease: string
      className?: string
      confidencePercent: number
    }>
  }
  messages: DiagnosisChatMessage[]
  message: string
}

export type DiagnosisChatResponse = {
  answer: string
}
