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
  diseaseFriendlyName?: string
  diseaseExplanation?: string
  confidence: number
  className?: string
  rawDiseaseLabel?: string
  topK?: Array<{
    className: string
    rawDiseaseLabel?: string
    crop: string
    disease: string
    diseaseFriendlyName?: string
    diseaseExplanation?: string
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
  rawDiseaseLabel?: string
  diseaseFriendlyName?: string
  diseaseExplanation?: string
  confidencePercent?: number
  status: 'High confidence' | 'Review needed'
  recommendation: string
  recommendationDetails?: RecommendationDetails
  notes: string
  predictions: ModelPrediction[]
}

export type ScanResponse = {
  id: string
  user_id?: string
  userEmail?: string
  timestamp?: string
  createdAt?: string
  image_filename?: string
  fileName?: string
  imageDataUrl?: string
  predictions: Array<{
    modelName: 'EfficientNet-B0' | 'MobileNetV2'
    crop: string
    disease: string
    className?: string
    rawDiseaseLabel?: string
    diseaseFriendlyName?: string
    diseaseExplanation?: string
    confidence: number
    confidencePercent?: number
    topK?: Array<{
      className: string
      rawDiseaseLabel?: string
      crop: string
      disease: string
      diseaseFriendlyName?: string
      diseaseExplanation?: string
      confidence: number
      confidencePercent?: number
    }>
  }>
  recommendation: string
  recommendation_details?: RecommendationDetails
  recommendationDetails?: RecommendationDetails
  disease_label?: string
  condition?: string
  rawDiseaseLabel?: string
  diseaseFriendlyName?: string
  diseaseExplanation?: string
  crop_type?: string
  cropType?: string
  confidence_percent?: number
  confidencePercent?: number
  status: 'High confidence' | 'Review needed'
  diagnosisState?: 'confident' | 'uncertain_need_more_photos' | 'out_of_scope'
  diagnosisStateLabel?: string
  diagnosisReason?: string
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
  rawDiseaseLabel?: string
  diseaseFriendlyName?: string
  diseaseExplanation?: string
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
    rawDiseaseLabel?: string
    diseaseFriendlyName?: string
    diseaseExplanation?: string
    confidence: number
    confidencePercent: number
    topK: Array<{
      className: string
      rawDiseaseLabel?: string
      crop: string
      disease: string
      diseaseFriendlyName?: string
      diseaseExplanation?: string
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
      rawDiseaseLabel?: string
      diseaseFriendlyName?: string
      diseaseExplanation?: string
      confidencePercent: number
    }>
  }
  messages: DiagnosisChatMessage[]
  message: string
}

export type DiagnosisChatResponse = {
  answer: string
}
