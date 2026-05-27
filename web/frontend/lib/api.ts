import axios from 'axios'
import type {
  DashboardData,
  MealResponse,
  MealCreate,
  UserProfile,
  SamsungHealthData,
  AuthStatus,
} from './types'

const axiosInstance = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
axiosInstance.interceptors.request.use((config) => {
  return config
})

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export const api = {
  getDashboard: (date: string) =>
    axiosInstance.get<DashboardData>(`/api/dashboard?date=${date}`),

  getMeals: (date: string) =>
    axiosInstance.get<MealResponse[]>(`/api/meals?date=${date}`),

  createMeal: (data: MealCreate) =>
    axiosInstance.post<MealResponse>('/api/meals', data),

  deleteMeal: (id: number) =>
    axiosInstance.delete(`/api/meals/${id}`),

  getProfile: () =>
    axiosInstance.get<UserProfile>('/api/profile'),

  updateProfile: (data: Partial<UserProfile>) =>
    axiosInstance.put<UserProfile>('/api/profile', data),

  getHealthData: (date: string) =>
    axiosInstance.get<SamsungHealthData>(`/api/health/daily?date=${date}`),

  getHealthAuthStatus: () =>
    axiosInstance.get<AuthStatus>('/api/health/auth-status'),

  getHealthAuthUrl: () =>
    axiosInstance.get<{ auth_url: string | null; message?: string }>('/api/health/auth-url'),
}

export default axiosInstance
