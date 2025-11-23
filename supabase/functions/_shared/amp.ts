export interface AmpConfig {
  projectId: string
  datasetId: string
  apiKey: string
  apiUrl: string
}

export interface EdgeSnapshot {
  snapshot_id: string
  opportunity_id: string
  polymarket_id: string
  kalshi_id: string
  timestamp: string
  polymarket_yes_price: number
  polymarket_no_price: number
  kalshi_yes_price: number
  kalshi_no_price: number
  edge_percent: number
  edge_strategy: string
  category: string
  polymarket_slug: string
  kalshi_ticker: string
  market_title: string
}

export interface EdgeAnalytics {
  opportunity_id: string
  edge_min: number
  edge_max: number
  edge_avg: number
  snapshot_count: number
  first_seen: string
  last_seen: string
  duration_minutes: number
  samples_above_threshold: number
  amp_edge_score: number
}

export function getAmpConfig(): AmpConfig {
  const projectId = Deno.env.get("AMP_PROJECT_ID") || "edgeandnode"
  const datasetId = Deno.env.get("AMP_DATASET_ID") || "prediction-market-edges"
  const apiKey = Deno.env.get("AMP_API_KEY")
  const apiUrl = Deno.env.get("AMP_API_URL") || "https://gateway.amp.staging.thegraph.com"

  if (!apiKey) {
    throw new Error("AMP_API_KEY (bearer token) must be set")
  }

  return { projectId, datasetId, apiKey, apiUrl }
}

// Publish edge snapshots to Amp
export async function publishEdgeSnapshots(snapshots: EdgeSnapshot[]): Promise<void> {
  if (snapshots.length === 0) return

  const config = getAmpConfig()
  
  const url = `${config.apiUrl}/datasets/${config.datasetId}/records`
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "X-Amp-Project-Id": config.projectId,
    },
    body: JSON.stringify({ records: snapshots }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`Amp publish failed: ${response.status} ${errorText}`)
  }

  console.log(`Published ${snapshots.length} edge snapshots to Amp`)
}

// Query Amp to get edge analytics for a specific opportunity
export async function getEdgeAnalytics(
  opportunityId: string,
  timeWindowHours: number = 24,
  edgeThreshold: number = 5.0
): Promise<EdgeAnalytics | null> {
  const config = getAmpConfig()
  
  const query = `
    WITH stats AS (
      SELECT 
        opportunity_id,
        MIN(edge_percent) as edge_min,
        MAX(edge_percent) as edge_max,
        AVG(edge_percent) as edge_avg,
        COUNT(*) as snapshot_count,
        MIN(timestamp) as first_seen,
        MAX(timestamp) as last_seen
      FROM edge_snapshots
      WHERE opportunity_id = '${opportunityId}'
        AND timestamp >= NOW() - INTERVAL '${timeWindowHours} hours'
        AND edge_percent > 0
      GROUP BY opportunity_id
    ),
    above_threshold AS (
      SELECT COUNT(*) as samples_above_threshold
      FROM edge_snapshots
      WHERE opportunity_id = '${opportunityId}'
        AND edge_percent >= ${edgeThreshold}
        AND timestamp >= NOW() - INTERVAL '${timeWindowHours} hours'
    )
    SELECT 
      s.opportunity_id,
      s.edge_min,
      s.edge_max,
      s.edge_avg,
      s.snapshot_count,
      s.first_seen,
      s.last_seen,
      EXTRACT(EPOCH FROM (s.last_seen - s.first_seen)) / 60 as duration_minutes,
      COALESCE(t.samples_above_threshold, 0) as samples_above_threshold,
      (s.edge_avg * 0.4 + 
       (EXTRACT(EPOCH FROM (s.last_seen - s.first_seen)) / 3600) * 0.3 + 
       (s.snapshot_count / 60.0) * 0.3) as amp_edge_score
    FROM stats s
    CROSS JOIN above_threshold t;
  `

  const url = `${config.apiUrl}/datasets/${config.datasetId}/query`
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "X-Amp-Project-Id": config.projectId,
    },
    body: JSON.stringify({ sql: query }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`Amp query failed: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  
  if (!result.rows || result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  
  return {
    opportunity_id: row.opportunity_id,
    edge_min: parseFloat(row.edge_min),
    edge_max: parseFloat(row.edge_max),
    edge_avg: parseFloat(row.edge_avg),
    snapshot_count: parseInt(row.snapshot_count),
    first_seen: row.first_seen,
    last_seen: row.last_seen,
    duration_minutes: parseFloat(row.duration_minutes),
    samples_above_threshold: parseInt(row.samples_above_threshold),
    amp_edge_score: parseFloat(row.amp_edge_score),
  }
}

// Get edge history time series for charting
export async function getEdgeHistory(
  opportunityId: string,
  timeWindowHours: number = 24
): Promise<Array<{ timestamp: string; edge_percent: number }>> {
  const config = getAmpConfig()
  
  const query = `
    SELECT 
      timestamp,
      edge_percent
    FROM edge_snapshots
    WHERE opportunity_id = '${opportunityId}'
      AND timestamp >= NOW() - INTERVAL '${timeWindowHours} hours'
    ORDER BY timestamp ASC;
  `

  const url = `${config.apiUrl}/datasets/${config.datasetId}/query`
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "X-Amp-Project-Id": config.projectId,
    },
    body: JSON.stringify({ sql: query }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`Amp query failed: ${response.status} ${errorText}`)
  }

  const result = await response.json()
  
  return (result.rows || []).map((row: any) => ({
    timestamp: row.timestamp,
    edge_percent: parseFloat(row.edge_percent),
  }))
}
