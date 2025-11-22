import { Link } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'

export function Home() {
  const { isConnected, connect } = useWallet()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="relative min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
        <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 w-full max-w-4xl mx-auto pt-24">
          <div className="relative mb-8">
            <img 
              src="/hero_img.png" 
              alt="Trading background" 
              className="w-80 h-80 mx-auto mb-8 rounded-3xl shadow-2xl border-4 border-gray-200"
            />
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[0.9] mb-8 tracking-tight">
              <span className="block text-black dark:text-white">YOUR</span>
              <span className="block text-cyan-500">EDGE FINDER</span>
              <span className="block text-black dark:text-white">FOR</span>
              <span className="block text-cyan-500">PREDICTION</span>
              <span className="block text-cyan-500">MARKETS</span>
            </h1>
          </div>
          
          <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto font-medium mb-8">
            Spot profitable price differences across Polymarket and Kalshi. Trade strategies across prediction markets all in one platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
            <div className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">Polymarket</div>
            <div className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold">Kalshi</div>
            <div className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">Arbitrage</div>
            <div className="px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold">Real-time</div>
            <div className="px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-semibold">Automated</div>
            <div className="px-4 py-2 bg-gray-900 text-white rounded-full text-sm font-semibold">EdgeFinder</div>
          </div>

          {isConnected ? (
            <Link
              to="/app"
              className="inline-flex items-center px-16 py-6 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black text-2xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300 shadow-2xl transform hover:scale-105"
            >
              Launch App
            </Link>
          ) : (
            <button
              onClick={connect}
              className="inline-flex items-center px-16 py-6 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black text-2xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300 shadow-2xl transform hover:scale-105"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-black dark:text-white">$1</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">to unlock data</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-black dark:text-white">5-15%</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">typical spreads</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-black dark:text-white">24/7</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">opportunities</div>
          </div>
        </div>
      </div>

      <div id="how-it-works" className="relative bg-white py-24">
        <div className="absolute inset-0 opacity-5">
          <div className="w-full h-full" style={{
            backgroundImage: `radial-gradient(circle, #000 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}></div>
        </div>
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 mb-24">
            
            <div className="text-center">
              <h3 className="text-2xl font-bold text-black mb-6 uppercase tracking-wide">
                SPOT PRICE GAPS INSTANTLY
              </h3>
              
              <div className="relative mx-auto w-80 mb-6">
                <img 
                  src="/home/card_1.png" 
                  alt="Side-by-side market price comparison" 
                  className="w-full h-auto"
                />
              </div>
              
              <p className="text-gray-600 text-sm max-w-xs mx-auto">
                Our algorithm scans Polymarket and Kalshi 24/7 to find events with profitable price differences.
              </p>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-black mb-6 uppercase tracking-wide">
                CALCULATE PROFITS AUTOMATICALLY
              </h3>
              
              <div className="relative mx-auto w-80 mb-6">
                <img 
                  src="/home/card_2.png" 
                  alt="Profit calculator showing ROI and returns" 
                  className="w-full h-auto"
                />
              </div>
              
              <p className="text-gray-600 text-sm max-w-xs mx-auto">
                See exact profit potential, ROI percentages, and optimal betting strategies for each opportunity.
              </p>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-black mb-6 uppercase tracking-wide">
                TRADE WITH ONE CLICK
              </h3>
              
              <div className="relative mx-auto w-80 mb-6">
                <img 
                  src="/home/card_3.png" 
                  alt="One-click trading interface with platform links" 
                  className="w-full h-auto"
                />
              </div>
              
              <p className="text-gray-600 text-sm max-w-xs mx-auto">
                Direct links to both platforms with pre-filled bet amounts. No manual searching or calculations.
              </p>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-bold text-black mb-6 uppercase tracking-wide">
                REAL-TIME MARKET UPDATES
              </h3>
              
              <div className="relative mx-auto w-80 mb-6">
                <img 
                  src="/home/card_4.png" 
                  alt="Real-time data feed with live market updates" 
                  className="w-full h-auto"
                />
              </div>
              
              <p className="text-gray-600 text-sm max-w-xs mx-auto">
                Fresh data every hour ensures you never miss profitable opportunities as markets move.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-16">
          <div className="w-16 h-1 bg-cyan-500 rounded-full"></div>
        </div>

        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-black text-black mb-8 uppercase tracking-wide">
            BRING EVERYTHING TOGETHER
            <br />
            <span className="text-cyan-500">AND AUTOMATE IT TOO</span>
          </h2>
          
          <div className="relative mx-auto mb-12 max-w-2xl">
            <div className="bg-black rounded-3xl p-4 shadow-2xl">
              <img 
                src="/home/card_5.png" 
                alt="EdgeFinder dashboard showing automated profit opportunities" 
                className="w-full h-auto rounded-2xl"
              />
            </div>
          </div>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12">
            We scan both markets every hour and serve you only the most profitable opportunities. 
          </p>
          
          {isConnected ? (
            <Link
              to="/app"
              className="inline-flex items-center px-20 py-8 bg-black dark:bg-white text-white dark:text-black rounded-3xl font-black text-3xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300 shadow-2xl transform hover:scale-105"
            >
              Launch EdgeFinder Now
            </Link>
          ) : (
            <button
              onClick={connect}
              className="inline-flex items-center px-20 py-8 bg-black dark:bg-white text-white dark:text-black rounded-3xl font-black text-3xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-300 shadow-2xl transform hover:scale-105"
            >
              Start Finding Opportunities
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
