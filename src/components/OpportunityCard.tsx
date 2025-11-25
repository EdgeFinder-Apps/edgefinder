import { MatchedEvent } from '../types'

type OpportunityCardProps = {
  event: MatchedEvent
}

export function OpportunityCard({ event }: OpportunityCardProps) {
  const polymarket = (event as any).polymarket || (event as any).polymarket_market;
  const kalshi = (event as any).kalshi || (event as any).kalshi_market;
  
  if (!polymarket || !kalshi) {
    return null;
  }
  
  const clampPrice = (value: number) => Math.max(0, Math.min(1, value))
  
  const normalizedEvent = {
    ...event,
    polymarket: polymarket.yesPrice !== undefined ? polymarket : {
      marketId: polymarket.slug || '',
      yesPrice: clampPrice(polymarket.last_trade_price ? parseFloat(polymarket.last_trade_price) : 0.5),
      noPrice: clampPrice(polymarket.last_trade_price ? 1 - parseFloat(polymarket.last_trade_price) : 0.5),
      url: `https://polymarket.com/event/${polymarket.slug || ''}`,
      liquidityUSD: polymarket.volume ? parseFloat(polymarket.volume) : 0
    },
    kalshi: kalshi.yesPrice !== undefined ? kalshi : {
      ticker: kalshi.ticker || '',
      yesPrice: kalshi.yes_ask ? parseFloat(kalshi.yes_ask) / 100 : 0.5,
      noPrice: kalshi.no_bid ? parseFloat(kalshi.no_bid) / 100 : 0.5,
      url: `https://kalshi.com/markets/${kalshi.ticker || ''}`,
      liquidityUSD: 0
    },
    title: event.title || polymarket.question || kalshi.title || 'Unknown Event'
  };
  
  const displayEvent = normalizedEvent;

  const formatPrice = (price: number) => `${(price * 100).toFixed(1)}¢`

  const calculateProfitMetrics = () => {
    if (!displayEvent?.polymarket?.yesPrice || !displayEvent?.kalshi?.yesPrice) {
      return {
        isArbitrage: false,
        profitPerDollar: 0,
        roiPercentage: 0,
        bestStrategy: 'NONE' as const
      }
    }
    
    const option1 = displayEvent.polymarket.yesPrice + displayEvent.kalshi.noPrice // Buy YES on PM, NO on Kalshi
    const option2 = displayEvent.kalshi.yesPrice + displayEvent.polymarket.noPrice // Buy YES on Kalshi, NO on PM
    
    const bestCost = Math.min(option1, option2)
    const isArbitrage = bestCost < 1.0
    const profitPerDollar = isArbitrage ? (1.0 - bestCost) : 0
    const roiPercentage = isArbitrage ? profitPerDollar * 100 : 0
    
    return {
      isArbitrage,
      profitPerDollar,
      roiPercentage,
      bestStrategy: option1 < option2 ? 'BUY_YES_PM_BUY_NO_KALSHI' : 'BUY_YES_KALSHI_BUY_NO_PM'
    }
  }

  const getHintText = (hint: string) => {
    switch (hint) {
      case 'BUY_YES_PM_BUY_NO_KALSHI':
        return 'Buy YES on Polymarket, NO on Kalshi'
      case 'BUY_YES_KALSHI_BUY_NO_PM':
        return 'Buy YES on Kalshi, NO on Polymarket'
      default:
        return 'No clear arbitrage opportunity'
    }
  }

  const profitMetrics = calculateProfitMetrics()

  const endDate = new Date(displayEvent.endDateISO || new Date()).toLocaleDateString()

  return (
    <div className={`card p-6 sm:p-8 space-y-6 hover:scale-[1.01] transition-all duration-300 ${displayEvent.isStale ? 'opacity-60' : ''}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-bold text-xl leading-tight">{displayEvent.title}</h3>
          {displayEvent.isStale && (
            <span className="badge bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Stale
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Ends {endDate}</span>
        </div>
      </div>

      {profitMetrics.isArbitrage ? (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 px-4 py-3 rounded-xl border-2 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="font-semibold text-green-800 dark:text-green-200">Arbitrage Opportunity</span>
            </div>
            <span className="badge bg-green-600 text-white">
              {profitMetrics.roiPercentage.toFixed(1)}% ROI
            </span>
          </div>
          <div className="text-sm text-green-700 dark:text-green-300 mb-1">
            {getHintText(profitMetrics.bestStrategy)}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-green-600 dark:text-green-400">
              Potential: {(profitMetrics.profitPerDollar * 100).toFixed(1)}¢ per $1
            </span>
            <span className="text-green-500 dark:text-green-500">
              *Excludes fees, subject to liquidity
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-gray-600 dark:text-gray-400 font-medium">No arbitrage opportunity detected</span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Prices may change - monitor for opportunities
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3 p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-xl border border-purple-200/50 dark:border-purple-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">P</span>
              </div>
              <h4 className="font-bold text-base">Polymarket</h4>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-sm px-4 py-3 rounded-lg border border-green-200 dark:border-green-800/50">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">YES</div>
              <div className="font-bold text-lg text-green-600 dark:text-green-400">{formatPrice(displayEvent.polymarket.yesPrice)}</div>
            </div>
            <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-sm px-4 py-3 rounded-lg border border-red-200 dark:border-red-800/50">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">NO</div>
              <div className="font-bold text-lg text-red-600 dark:text-red-400">{formatPrice(displayEvent.polymarket.noPrice)}</div>
            </div>
          </div>
          <a
            href={displayEvent.polymarket.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-center rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <span>Trade on Polymarket</span>
            <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>

        <div className="space-y-3 p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">K</span>
              </div>
              <h4 className="font-bold text-base">Kalshi</h4>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-sm px-4 py-3 rounded-lg border border-green-200 dark:border-green-800/50">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">YES</div>
              <div className="font-bold text-lg text-green-600 dark:text-green-400">{formatPrice(displayEvent.kalshi.yesPrice)}</div>
            </div>
            <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-sm px-4 py-3 rounded-lg border border-red-200 dark:border-red-800/50">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">NO</div>
              <div className="font-bold text-lg text-red-600 dark:text-red-400">{formatPrice(displayEvent.kalshi.noPrice)}</div>
            </div>
          </div>
          <a
            href={displayEvent.kalshi.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-center rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <span>Trade on Kalshi</span>
            <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
