import { MatchedEvent, UserDataset } from '../types'
import { createClient } from '@supabase/supabase-js'

// Supabase client configuration
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

interface ArbitrageOpportunity {
  polymarket_question: string
  kalshi_title: string
  similarity_score: number
  poly_price_cents: string
  kalshi_price_cents: string
  price_diff_cents: string
  direction_aligned: boolean
  direction_confidence: number
  direction_notes: string
  poly_slug: string
  kalshi_ticker: string
  poly_end_date: string | null
  kalshi_expiration_time: string
}

export async function fetchOpportunities(): Promise<MatchedEvent[]> {
  try {
    const { data, error } = await supabase
      .from('verified_arbitrage_opportunities')
      .select('*')
      .order('price_diff_cents', { ascending: false })
      .limit(50)

    if (error) throw error
    if (!data) return []

    // make Supabase data into MatchedEvent format
    return data.map((opp: ArbitrageOpportunity) => {
      const polyPriceCents = parseFloat(opp.poly_price_cents)
      const kalshiPriceCents = parseFloat(opp.kalshi_price_cents)
      const spreadCents = parseFloat(opp.price_diff_cents)

      // Convert cents to 0-1 range
      const polyYesPrice = polyPriceCents / 100
      const kalshiYesPrice = kalshiPriceCents / 100

      // Determine arbitrage direction
      let hint: "BUY_YES_PM_BUY_NO_KALSHI" | "BUY_YES_KALSHI_BUY_NO_PM" | "NONE" = "NONE"
      if (polyYesPrice < kalshiYesPrice) {
        hint = "BUY_YES_PM_BUY_NO_KALSHI"
      } else if (kalshiYesPrice < polyYesPrice) {
        hint = "BUY_YES_KALSHI_BUY_NO_PM"
      }

      return {
        id: `${opp.poly_slug}-${opp.kalshi_ticker}`,
        title: opp.polymarket_question,
        category: 'Politics',
        endDateISO: opp.poly_end_date || opp.kalshi_expiration_time,
        polymarket: {
          marketId: opp.poly_slug,
          yesPrice: polyYesPrice,
          noPrice: 1 - polyYesPrice,
          url: (() => {
            // make a URL friendly version of the question
            const slug = (opp.polymarket_question || opp.poly_slug || '')
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-+|-+$/g, '')
            return `https://polymarket.com/market/${slug}`
          })(),
          liquidityUSD: 10000, // just a placeholder
        },
        kalshi: {
          ticker: opp.kalshi_ticker,
          yesPrice: kalshiYesPrice,
          noPrice: 1 - kalshiYesPrice,
          // make Kalshi URL in format: /markets/{base_ticker}/{short_slug}/{full_ticker}
          // example: /markets/kxdeportcount/deportcount/kxdeportcount-25
          url: (() => {
            const t = opp.kalshi_ticker || ''
            // get the base ticker (everything before the last segment)
            const segments = t.split('-')
            const baseTicker = segments.length > 1 ? segments[0] : t
            const shortSlug = baseTicker.replace(/^kx/i, '').toLowerCase()
            
            // Use only the first two segments for the final part of the URL
            const finalTicker = segments.length > 1 ? `${segments[0]}-${segments[1]}` : t
            return `https://kalshi.com/markets/${baseTicker.toLowerCase()}/${shortSlug}/${finalTicker.toLowerCase()}`
          })(),
          liquidityUSD: 10000, // just another placeholder
        },
        spreadPercent: spreadCents,
        hint,
      }
    })
  } catch (error) {
    console.error('Error fetching opportunities:', error)
    return []
  }
}

export async function refreshDataset(): Promise<UserDataset> {
  const items = await fetchOpportunities()
  const now = new Date()
  const nextAvailable = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now

  return {
    fetchedAtISO: now.toISOString(),
    nextAvailableAtISO: nextAvailable.toISOString(),
    items,
  }
}

export interface OpportunitiesAPI {
  fetchOpportunities: () => Promise<MatchedEvent[]>
  refreshDataset: () => Promise<UserDataset>
}

export const opportunitiesAPI: OpportunitiesAPI = {
  fetchOpportunities,
  refreshDataset,
}
