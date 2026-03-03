import type { AnalysisResponse, DashboardResponse } from '../types/api'

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function fetchDashboard(): Promise<DashboardResponse> {
  return request<DashboardResponse>('/api/dashboard')
}

export function fetchAnalysis(symbol: string): Promise<AnalysisResponse> {
  return request<AnalysisResponse>(`/api/analyze/${symbol}`)
}
