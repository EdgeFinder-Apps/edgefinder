import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'
import { ThemeToggle } from './ThemeToggle'

export function NavBar() {
  const { address, isConnected, connect, disconnect } = useWallet()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <nav className="absolute top-0 left-0 right-0 z-50 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-cyan-500 rounded-2xl flex items-center justify-center">
              <span className="text-white font-black text-lg">E</span>
            </div>
            <span className="font-black text-xl hidden sm:inline text-black dark:text-white">EdgeFinder</span>
          </Link>

          <div className="flex items-center space-x-2 sm:space-x-6">
            <Link
              to="/"
              className={`px-4 py-2 rounded-xl font-bold transition-all ${
                isActive('/') 
                  ? 'bg-black text-white dark:bg-white dark:text-black' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              Home
            </Link>
            {isConnected && (
              <>
                <Link
                  to="/app"
                  className={`px-4 py-2 rounded-xl font-bold transition-all ${
                    isActive('/app') 
                      ? 'bg-black text-white dark:bg-white dark:text-black' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  to="/sandbox"
                  className={`px-4 py-2 rounded-xl font-bold transition-all ${
                    isActive('/sandbox') 
                      ? 'bg-purple-600 text-white dark:bg-purple-500 dark:text-white' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Sandbox
                </Link>
              </>
            )}

            <ThemeToggle />

            {isConnected ? (
              <button
                onClick={disconnect}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {formatAddress(address!)}
              </button>
            ) : (
              <button
                onClick={connect}
                className="px-4 py-2 bg-cyan-500 text-white rounded-xl font-bold text-sm hover:bg-cyan-600 transition-colors"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
