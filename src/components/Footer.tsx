import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200/50 dark:border-gray-700/50 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-sky-600 to-sky-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-sky-500">
                EdgeFinder
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
              Find profitable price differences between prediction markets. 
              Professional tools for smart traders seeking consistent profits.
            </p>
            <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
              <span>Live Data</span>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Product</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/" className="text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/app" className="text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <a href="#how-it-works" className="text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  How It Works
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/terms" className="text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            © 2025 EdgeFinder. Built for traders.
          </p>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Not financial advice
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Trade at your own risk
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
