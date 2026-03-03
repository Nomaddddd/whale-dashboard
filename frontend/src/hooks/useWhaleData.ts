import { useCallback, useEffect, useState } from 'react'
import { fetchAnalysis, fetchDashboard } from '../lib/api'
import type { AnalysisResponse, DashboardResponse } from '../types/api'

interface WhaleDataState {
  dashboardData: DashboardResponse | null
  analysisData: AnalysisResponse | null
}

interface UseWhaleDataResult {
  data: WhaleDataState
  loading: boolean
  error: string | null
  lastUpdated: number | null
}

export function useWhaleData(symbol: string): UseWhaleDataResult {
  const [data, setData] = useState<WhaleDataState>({
    dashboardData: null,
    analysisData: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [dashboardData, analysisData] = await Promise.all([
        fetchDashboard(),
        fetchAnalysis(symbol),
      ])
      setData({ dashboardData, analysisData })
      setLastUpdated(Date.now())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown API error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [symbol])

  useEffect(() => {
    setLoading(true)
    void loadData()
    const id = window.setInterval(() => {
      void loadData()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [loadData])

  return { data, loading, error, lastUpdated }
}
