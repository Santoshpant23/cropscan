import type { AuthUserResponse, UploadResponse, UserProfile } from '../types'

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
                .map((part) => String(part))
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
