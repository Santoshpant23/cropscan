export type DiagnosisState =
  | 'confident'
  | 'uncertain_need_more_photos'
  | 'out_of_scope'

export type ProductRecommendation = {
  title: string
  category: string
  priority: 'essential' | 'helpful' | 'monitoring'
  useCase: string
  timing: string
  buyerNote: string
  caution: string
}

export type PredictionThresholds = {
  maxProbMin: number
  marginMin: number
  entropyMax: number
}

export type TopPrediction = {
  className: string
  rawDiseaseLabel?: string
  crop: string
  disease: string
  diseaseFriendlyName?: string
  diseaseExplanation?: string
  confidence: number
  confidencePercent?: number
}

export type UploadTopPrediction = Omit<TopPrediction, 'confidencePercent'> & {
  confidencePercent: number
}

export type UserProfile = {
  name: string
  email: string
  role: string
  location: string
}

export type ModelPrediction = {
  modelName: string
  crop: string
  disease: string
  diseaseFriendlyName?: string
  diseaseExplanation?: string
  confidence: number
  confidenceMargin?: number
  entropy?: number
  temperature?: number
  thresholds?: PredictionThresholds
  className?: string
  rawDiseaseLabel?: string
  photoIndex?: number
  photoFileName?: string
  topK?: TopPrediction[]
}

export type RecommendationDetails = {
  headline: string
  urgency: 'low' | 'medium' | 'high'
  overview: string
  immediateSteps: string[]
  productCategories: string[]
  productRecommendations?: ProductRecommendation[]
  cautions: string[]
  followUp: string
}

export type PhotoResult = {
  photoIndex?: number
  fileName?: string
  cropType?: string
  condition?: string
  rawDiseaseLabel?: string
  diseaseFriendlyName?: string
  diseaseExplanation?: string
  confidencePercent?: number
  status?: 'High confidence' | 'Review needed'
  diagnosisState?: DiagnosisState
  diagnosisStateLabel?: string
  diagnosisReason?: string
  predictions?: ModelPrediction[]
}

export type AnalysisRecord = {
  id: string
  userEmail: string
  predictionToken?: string
  createdAt: string
  updatedAt?: string
  fileName: string
  imageDataUrl: string
  photoDataUrls?: string[]
  photoCount?: number
  plotId?: string
  plotName?: string
  scanLocationLabel?: string | null
  cropType?: string
  condition?: string
  rawDiseaseLabel?: string
  diseaseFriendlyName?: string
  diseaseExplanation?: string
  confidencePercent?: number
  status: 'High confidence' | 'Review needed'
  diagnosisState?: DiagnosisState
  diagnosisStateLabel?: string
  diagnosisReason?: string
  recommendation: string
  recommendationDetails?: RecommendationDetails
  notes: string
  accurate?: boolean | null
  consented_for_training?: boolean
  image_url?: string | null
  reviewedAt?: string | null
  photoResults?: PhotoResult[]
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
  photoDataUrls?: string[]
  photoCount?: number
  plotId?: string
  plotName?: string
  scanLocationLabel?: string
  predictions: Array<ModelPrediction & { confidencePercent?: number }>
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
  diagnosisState?: DiagnosisState
  diagnosisStateLabel?: string
  diagnosisReason?: string
  photoResults?: PhotoResult[]
  notes?: string
  accurate?: boolean | null
  consented_for_training?: boolean
  image_url?: string | null
  reviewedAt?: string | null
  updatedAt?: string
}

export type ScanFeedbackRequest = {
  accurate: boolean
  consented_for_training: boolean
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
  predictionToken: string
  fileName: string
  photoCount?: number
  cropType: string
  condition: string
  rawDiseaseLabel?: string
  diseaseFriendlyName?: string
  diseaseExplanation?: string
  confidenceScore: number
  confidencePercent: number
  status: 'High confidence' | 'Review needed'
  diagnosisState?: DiagnosisState
  diagnosisStateLabel?: string
  diagnosisReason?: string
  recommendation: string
  recommendationDetails: RecommendationDetails
  photoResults?: PhotoResult[]
  predictions: Array<
    Omit<ModelPrediction, 'topK'> & {
      className: string
      confidencePercent: number
      topK: UploadTopPrediction[]
    }
  >
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
      modelName: string
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

export type PasswordResetResponse = {
  message: string
  debugOtp?: string
}

export type PlotRecord = {
  id: string
  userEmail: string
  name: string
  crop: string
  latitude: number
  longitude: number
  areaSqFt: number
  locationLabel?: string | null
  locationSource: 'gps' | 'address' | 'manual'
  notes: string
  createdAt: string
  updatedAt: string
}

export type PlotCreateRequest = {
  name: string
  crop: string
  latitude: number
  longitude: number
  areaSqFt: number
  locationLabel?: string | null
  locationSource: 'gps' | 'address' | 'manual'
  notes?: string
}

export type PlotUpdateRequest = Partial<PlotCreateRequest>

export type PlotTodayCard = {
  plotId: string
  plotName: string
  crop: string
  headline: string
  riskLevel: 'low' | 'medium' | 'high'
  icon: string
  actions: string[]
  signals: {
    tonightLowF?: number | null
    todayHighF?: number | null
    frostProbability: number
    nextRainInches: number
    rainProbability: number
    heatStress: boolean
    droughtPressure: boolean
    source: string
  }
  generatedAt: string
}

export type GeocodeAddressResponse = {
  label: string
  latitude: number
  longitude: number
  source: 'address'
}

export type WalkFrameInput = {
  index: number
  timestampMs: number
  capturedAt: string
  dataUrl: string
}

export type WalkAnalyzeRequest = {
  frames: WalkFrameInput[]
  calibrationIndexes: number[]
}

export type WalkFrameResult = {
  index: number
  timestampMs: number
  capturedAt?: string | null
  status: 'ok' | 'calibration' | 'low_plant_signal' | 'too_blurry' | 'decode_failed' | string
  anomalyScore: number | null
  level: 'low' | 'medium' | 'high' | null
  greenRatio: number
  blurScore: number
  leafDetected?: boolean
  leafConfidence?: number | null
  leafLabel?: string | null
  diseaseName?: string | null
  diseaseConfidence?: number | null
  diseaseConfidencePercent?: number | null
}

export type WalkAnalyzeResponse = {
  framesAnalyzed: number
  validFrameCount: number
  skippedFrameCount: number
  calibrationFrameCount: number
  anomalyMean: number
  anomalyStdev: number
  frames: WalkFrameResult[]
  suspiciousIndexes: number[]
}

export type WalkSummaryWindow = {
  startMs: number
  endMs: number
  level: 'medium' | 'high'
}

export type WalkSummaryRequest = {
  framesAnalyzed: number
  validFrameCount: number
  skippedFrameCount: number
  calibrationFrameCount: number
  anomalyMean: number
  anomalyStdev: number
  suspiciousWindows: WalkSummaryWindow[]
  cropContext?: string
}

export type WalkSummaryResponse = {
  summary: string
}

export type WalkWarmupResponse = {
  ready: boolean
  coldStart: boolean
  durationSeconds: number
}
