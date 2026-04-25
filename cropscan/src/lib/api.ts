import type {
  AuthUserResponse,
  DiagnosisChatRequest,
  DiagnosisChatResponse,
  UploadResponse,
  UserProfile,
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

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      typeof payload?.detail === 'string'
        ? payload.detail
        : 'Request failed. Check the backend and try again.'
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  })
  return parseResponse<T>(response)
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

export async function uploadLeafRequest(file: File, token: string) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })
  return parseResponse<UploadResponse>(response)
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
