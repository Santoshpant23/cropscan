import type {
  AnalysisRecord,
  AuthUserResponse,
  DiagnosisChatRequest,
  DiagnosisChatResponse,
  GeocodeAddressResponse,
  PasswordResetResponse,
  PlotCreateRequest,
  PlotRecord,
  PlotTodayCard,
  PlotUpdateRequest,
  ScanResponse,
  UploadResponse,
  UserProfile,
  WalkAnalyzeRequest,
  WalkAnalyzeResponse,
  WalkSummaryRequest,
  WalkSummaryResponse,
  WalkWarmupResponse,
} from '../types'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '')

type TokenResponse = {
  access_token: string
  token_type: string
}

function toUserProfile(user: AuthUserResponse): UserProfile {
  return {
    name: user.full_name,
    email: user.email,
    role: user.role || 'Smallholder farmer',
    location: user.location || 'Knox County, TN',
  }
}

function toAnalysisRecord(scan: ScanResponse): AnalysisRecord {
  const predictions = scan.predictions.map((prediction) => ({
    modelName: prediction.modelName,
    crop: prediction.crop,
    disease: prediction.disease,
    diseaseFriendlyName: prediction.diseaseFriendlyName,
    diseaseExplanation: prediction.diseaseExplanation,
    className: prediction.className,
    rawDiseaseLabel: prediction.rawDiseaseLabel,
    confidence: Math.round(prediction.confidencePercent ?? prediction.confidence * 100),
    topK: prediction.topK?.map((topPrediction) => ({
      className: topPrediction.className,
      rawDiseaseLabel: topPrediction.rawDiseaseLabel,
      crop: topPrediction.crop,
      disease: topPrediction.disease,
      diseaseFriendlyName: topPrediction.diseaseFriendlyName,
      diseaseExplanation: topPrediction.diseaseExplanation,
      confidence: Math.round(
        topPrediction.confidencePercent ?? topPrediction.confidence * 100,
      ),
    })),
  }))

  return {
    id: scan.id,
    userEmail: scan.userEmail || '',
    createdAt: scan.createdAt ?? scan.timestamp ?? new Date().toISOString(),
    updatedAt: scan.updatedAt,
    fileName: scan.fileName ?? scan.image_filename ?? 'leaf-image',
    imageDataUrl: scan.imageDataUrl ?? '',
    photoDataUrls: scan.photoDataUrls,
    photoCount: scan.photoCount,
    plotId: scan.plotId,
    plotName: scan.plotName,
    scanLocationLabel: scan.scanLocationLabel,
    cropType: scan.cropType ?? scan.crop_type,
    condition: scan.condition ?? scan.disease_label,
    rawDiseaseLabel: scan.rawDiseaseLabel,
    diseaseFriendlyName: scan.diseaseFriendlyName,
    diseaseExplanation: scan.diseaseExplanation,
    confidencePercent: scan.confidencePercent ?? scan.confidence_percent,
    status: scan.status,
    diagnosisState: scan.diagnosisState,
    diagnosisStateLabel: scan.diagnosisStateLabel,
    diagnosisReason: scan.diagnosisReason,
    recommendation: scan.recommendation,
    recommendationDetails: scan.recommendationDetails || scan.recommendation_details,
    notes: scan.notes || '',
    reviewedAt: scan.reviewedAt,
    photoResults: scan.photoResults,
    predictions,
  }
}

function extractErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'detail' in payload &&
    typeof payload.detail === 'string'
  ) {
    return payload.detail
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'detail' in payload &&
    Array.isArray(payload.detail)
  ) {
    return payload.detail
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const message = 'msg' in entry && typeof entry.msg === 'string' ? entry.msg : null
        const location =
          'loc' in entry && Array.isArray(entry.loc)
            ? entry.loc
                .slice(1)
                .map((part: unknown) => String(part))
                .join('.')
            : ''
        if (!message) return null
        return location ? `${location}: ${message}` : message
      })
      .filter((message): message is string => Boolean(message))
      .join('; ')
  }

  return null
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = extractErrorMessage(payload) || 'Request failed. Check the backend and try again.'
    throw new Error(message)
  }
  return payload as T
}

async function requestJson<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
) {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    })
    return parseResponse<T>(response)
  } catch (error) {
    if (error instanceof Error && error.name === 'TypeError') {
      throw new Error(
        `Could not reach the server at ${API_BASE_URL}. Make sure the backend is running and CORS is configured correctly.`,
      )
    }
    throw error
  }
}

export async function loginRequest(email: string, password: string) {
  const tokenResponse = await requestJson<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const user = await getProfileRequest(tokenResponse.access_token)
  return { token: tokenResponse.access_token, user }
}

export async function signupRequest(profile: UserProfile, password: string) {
  const tokenResponse = await requestJson<TokenResponse>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      full_name: profile.name,
      email: profile.email,
      password,
      role: profile.role,
      location: profile.location,
    }),
  })
  const user = await getProfileRequest(tokenResponse.access_token)
  return { token: tokenResponse.access_token, user }
}

export async function forgotPasswordRequest(email: string, newPassword: string) {
  return requestJson<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email, new_password: newPassword }),
  })
}

export async function requestPasswordReset(email: string) {
  return requestJson<PasswordResetResponse>('/auth/forgot-password/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function confirmPasswordReset(
  email: string,
  otpCode: string,
  newPassword: string,
) {
  return requestJson<{ message: string }>('/auth/forgot-password/confirm', {
    method: 'POST',
    body: JSON.stringify({
      email,
      otp_code: otpCode,
      new_password: newPassword,
    }),
  })
}

export async function getProfileRequest(token: string) {
  const user = await requestJson<AuthUserResponse>('/auth/me', {
    method: 'GET',
    token,
  })
  return toUserProfile(user)
}

export async function updateProfileRequest(profile: UserProfile, token: string) {
  const user = await requestJson<AuthUserResponse>('/auth/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify({
      full_name: profile.name,
      email: profile.email,
      role: profile.role,
      location: profile.location,
    }),
  })
  return toUserProfile(user)
}

export async function uploadLeafRequest(fileOrFiles: File | File[], token: string) {
  const formData = new FormData()
  if (Array.isArray(fileOrFiles)) {
    fileOrFiles.forEach((file) => formData.append('files', file))
  } else {
    formData.append('file', fileOrFiles)
  }

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })
  return parseResponse<UploadResponse>(response)
}

export async function getScansRequest(token: string) {
  const scans = await requestJson<ScanResponse[]>('/scans', {
    method: 'GET',
    token,
  })
  return scans.map(toAnalysisRecord)
}

export async function deleteScanRequest(scanId: string, token: string) {
  return requestJson<void>(`/scans/${scanId}`, {
    method: 'DELETE',
    token,
  })
}

export async function markScanReviewedRequest(scanId: string, token: string) {
  return requestJson<ScanResponse>(`/scans/${scanId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ reviewed: true }),
  }).then(toAnalysisRecord)
}

export async function saveScanRequest(record: AnalysisRecord, token: string) {
  return requestJson<ScanResponse>('/scans', {
    method: 'POST',
    token,
    body: JSON.stringify(record),
  }).then(toAnalysisRecord)
}

export async function diagnosisChatRequest(
  payload: DiagnosisChatRequest,
  token: string,
) {
  return requestJson<DiagnosisChatResponse>('/chat', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function getPlotsRequest(token: string) {
  return requestJson<PlotRecord[]>('/plots', {
    method: 'GET',
    token,
  })
}

export async function createPlotRequest(payload: PlotCreateRequest, token: string) {
  return requestJson<PlotRecord>('/plots', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function updatePlotRequest(
  plotId: string,
  payload: PlotUpdateRequest,
  token: string,
) {
  return requestJson<PlotRecord>(`/plots/${plotId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  })
}

export async function deletePlotRequest(plotId: string, token: string) {
  return requestJson<void>(`/plots/${plotId}`, {
    method: 'DELETE',
    token,
  })
}

export async function getPlotTodayRequest(plotId: string, token: string) {
  return requestJson<PlotTodayCard>(`/plots/${plotId}/today`, {
    method: 'GET',
    token,
  })
}

export async function geocodeAddressRequest(address: string, token: string) {
  const params = new URLSearchParams({ address })
  return requestJson<GeocodeAddressResponse>(`/locations/geocode?${params}`, {
    method: 'GET',
    token,
  })
}

export async function walkAnalyzeRequest(
  payload: WalkAnalyzeRequest,
  token: string,
) {
  return requestJson<WalkAnalyzeResponse>('/walk-scan/analyze', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function walkSummaryRequest(
  payload: WalkSummaryRequest,
  token: string,
) {
  return requestJson<WalkSummaryResponse>('/walk-scan/summary', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  })
}

export async function walkWarmupRequest(token: string) {
  return requestJson<WalkWarmupResponse>('/walk-scan/warmup', {
    method: 'POST',
    token,
  })
}
