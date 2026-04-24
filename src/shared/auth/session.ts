import { AxiosError } from 'axios'
import { env } from '../config/env'
import { publicHttp } from '../api/http'

type RoleValue = 'applicant' | 'company' | 'admin'

type TokenResponse = {
  access_token: string
  refresh_token: string
  token_type: string
}

const ACCESS_TOKEN_KEY = 'access_token'
const ROLE_KEY = 'role'

export const authSession = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),

  setAccessToken: (token: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  },

  getRole: () => localStorage.getItem(ROLE_KEY),

  setRole: (role: RoleValue) => {
    localStorage.setItem(ROLE_KEY, role)
  },

  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
  },
}

export const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const { data } = await publicHttp.post<TokenResponse>('/auth/refresh', {})

    if (!data?.access_token) {
      authSession.clear()
      return null
    }

    authSession.setAccessToken(data.access_token)
    return data.access_token
  } catch (error) {
    const axiosErr = error as AxiosError

    if (
      axiosErr.response?.status === 400 ||
      axiosErr.response?.status === 401 ||
      axiosErr.response?.status === 429
    ) {
      authSession.clear()
      return null
    }

    authSession.clear()
    return null
  }
}

export const initializeSession = async (): Promise<boolean> => {
  if (authSession.getAccessToken()) {
    return true
  }

  const refreshed = await refreshAccessToken()
  return Boolean(refreshed)
}