export type MatchedEvent = {
  id: string
  title: string
  category: string
  endDateISO: string
  polymarket: {
    marketId: string
    yesPrice: number
    noPrice: number 
    url: string
    liquidityUSD: number
  }
  kalshi: {
    ticker: string
    yesPrice: number
    noPrice: number 
    url: string
    liquidityUSD: number
  }
  spreadPercent: number
  hint: "BUY_YES_PM_BUY_NO_KALSHI" | "BUY_YES_KALSHI_BUY_NO_PM" | "NONE"
  isStale?: boolean
  lastRefreshed?: string
}

export type UserDataset = {
  fetchedAtISO: string
  nextAvailableAtISO: string
  items: MatchedEvent[]
}
