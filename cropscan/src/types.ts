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
  confidence: number
  confidenceMargin?: number
  entropy?: number
  temperature?: number
  thresholds?: {
    maxProbMin: number
    marginMin: number
    entropyMax: number
  }
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
  productRecommendations?: ProductRecommendation[]
  cautions: string[]
  followUp: string
}

export type ProductRecommendation = {
  title: string
  category: string
  priority: 'essential' | 'helpful' | 'monitoring'
  useCase: string
  timing: string
  buyerNote: string
  caution: string
}

export type AnalysisRecord = {
  id: string
  userEmail: string
  predictionToken?: string
  createdAt: string
  fileName: string
  imageDataUrl: string
  photoDataUrls?: string[]
  photoCount?: number
  plotId?: string
  plotName?: string
  scanLocationLabel?: string
  cropType?: string
  condition?: string
  confidencePercent?: number
  status: 'High confidence' | 'Review needed'
  diagnosisState?: 'confident' | 'uncertain_need_more_photos' | 'out_of_scope'
  diagnosisStateLabel?: string
  diagnosisReason?: string
  recommendation: string
  recommendationDetails?: RecommendationDetails
  notes: string
  predictions: ModelPrediction[]
  photoResults?: PhotoUploadResult[]
}

export type AuthUserResponse = {
  id: string
  full_name: string
  email: string
  role?: string
  location?: string
}

export type PhotoUploadResult = {
  fileName: string
  cropType: string
  condition: string
  confidenceScore: number
  confidencePercent: number
  status: 'High confidence' | 'Review needed'
  diagnosisState?: 'confident' | 'uncertain_need_more_photos' | 'out_of_scope'
  diagnosisStateLabel?: string
  diagnosisReason?: string
  recommendation: string
  recommendationDetails: RecommendationDetails
  predictions: Array<{
    modelName: string
    crop: string
    disease: string
    className: string
    confidence: number
    confidencePercent: number
    confidenceMargin?: number
    entropy?: number
    temperature?: number
    thresholds?: {
      maxProbMin: number
      marginMin: number
      entropyMax: number
    }
    topK: Array<{
      className: string
      crop: string
      disease: string
      confidence: number
      confidencePercent: number
    }>
  }>
}

export type UploadResponse = PhotoUploadResult & {
  predictionToken: string
  imageHashes: string[]
  photoCount?: number
  photoResults?: PhotoUploadResult[]
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
      confidencePercent: number
    }>
  }
  messages: DiagnosisChatMessage[]
  message: string
}

export type DiagnosisChatResponse = {
  answer: string
}

export type PlotRecord = {
  id: string
  userEmail: string
  name: string
  crop: string
  latitude: number
  longitude: number
  areaSqFt: number
  locationLabel?: string
  locationSource?: 'gps' | 'address' | 'manual'
  notes: string
  createdAt: string
  updatedAt: string
}

export type GeocodedLocation = {
  label: string
  latitude: number
  longitude: number
  source: 'address'
}

export type PlotDayForecast = {
  date: string
  lowF?: number | null
  highF?: number | null
  rainInches: number
  rainProbability: number
  summary: string
}

export type PlotTodaySignals = {
  tonightLowF?: number | null
  todayHighF?: number | null
  frostProbability: number
  nextRainInches: number
  rainProbability: number
  heatStress: boolean
  droughtPressure: boolean
  source: string
  nextDays?: PlotDayForecast[]
}

export type PlotRecentScan = {
  id: string
  fileName: string
  createdAt: string
  cropType?: string | null
  condition?: string | null
  status: string
  diagnosisState?: string | null
  diagnosisStateLabel?: string | null
  confidencePercent?: number | null
}

export type PlotRecentScansResponse = {
  plotId: string
  scans: PlotRecentScan[]
  needsReviewCount: number
  totalCount: number
}

export type PlotTodayCard = {
  plotId: string
  plotName: string
  crop: string
  headline: string
  riskLevel: 'low' | 'medium' | 'high'
  icon: 'frost' | 'heat' | 'dry' | 'rain' | 'scout' | string
  actions: string[]
  signals: PlotTodaySignals
  generatedAt: string
}

export type PlotCareGuide = {
  plotId: string
  plotName: string
  crop: string
  riskLevel: 'low' | 'medium' | 'high'
  headline: string
  problemSummary: string
  careSteps: string[]
  watchFor: string[]
  avoid: string[]
  nextCheck: string
  signals: PlotTodaySignals
  generatedAt: string
}

export type WalkFrameStatus =
  | 'calibration'
  | 'ok'
  | 'low_plant_signal'
  | 'too_blurry'
  | 'decode_failed'

export type WalkFrameLevel = 'low' | 'medium' | 'high'

export type WalkFrameInput = {
  index: number
  timestampMs: number
  dataUrl: string
}

export type WalkAnalyzeRequest = {
  frames: WalkFrameInput[]
  calibrationIndexes: number[]
}

export type WalkFrameResult = {
  index: number
  timestampMs: number
  status: WalkFrameStatus
  anomalyScore: number | null
  level: WalkFrameLevel | null
  greenRatio: number
  blurScore: number
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
  level: WalkFrameLevel
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
