/**
 * Amp Analytics API Client
 * 
 * Frontend client for fetching edge analytics powered by Amp from The Graph.
 */

const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY

export interface EdgeAnalytics {
  edge_min: number
  edge_max: number
  edge_avg: number
  snapshot_count: number
  first_seen: string
  last_seen: string
  duration_minutes: number
  samples_above_threshold: number
  amp_edge_score: number
  edge_quality: 'STABLE' | 'PERSISTENT' | 'STABLE_SHORT' | 'NOISY'
  is_persistent: boolean
  is_stable: boolean
}

export interface AnalyticsResponse {
  opportunity_id: string
  has_data: boolean
  analytics?: EdgeAnalytics
  metadata?: {
    time_window_hours: number
    edge_threshold: number
    powered_by: string
  }
  message?: string
}

export async function getOpportunityAnalytics(
  opportunityId: string,
  timeWindowHours: number = 24,
  edgeThreshold: number = 5.0
): Promise<AnalyticsResponse> {
  const url = new URL(`${SUPABASE_URL}/functions/v1/amp-opportunity-analytics`)
  url.searchParams.set('opportunity_id', opportunityId)
  url.searchParams.set('time_window_hours', timeWindowHours.toString())
  url.searchParams.set('edge_threshold', edgeThreshold.toString())

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.message || error.error || 'Failed to fetch analytics')
  }

  return await response.json()
}

export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return 'Less than 1 min'
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

export function getEdgeQualityLabel(quality: string): { label: string; color: string } {
  switch (quality) {
    case 'STABLE':
      return { label: 'Stable Edge', color: 'text-green-600 dark:text-green-400' }
    case 'PERSISTENT':
      return { label: 'Persistent Edge', color: 'text-blue-600 dark:text-blue-400' }
    case 'STABLE_SHORT':
      return { label: 'Stable (Short)', color: 'text-cyan-600 dark:text-cyan-400' }
    case 'NOISY':
      return { label: 'Noisy Edge', color: 'text-amber-600 dark:text-amber-400' }
    default:
      return { label: 'Unknown', color: 'text-gray-600 dark:text-gray-400' }
  }
}
