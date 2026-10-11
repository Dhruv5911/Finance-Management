/**
 * FinAI API Client (Axios)
 * Configured with base URL, credentials, and automatic Bearer JWT Token attachment.
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '',
  withCredentials: true,
})

// Attach Bearer JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('finai_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

// Intercept responses for global 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Optional: clear token if expired
    }
    return Promise.reject(error)
  }
)

export default api
