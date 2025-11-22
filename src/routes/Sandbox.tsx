import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { EVVMSandboxAction } from '../lib/evvm'

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function Sandbox() {
  const [actions, setActions] = useState<EVVMSandboxAction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSandboxActions = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('evvm_sandbox_actions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)

        if (fetchError) {
          throw new Error(fetchError.message)
        }

        setActions(data || [])
      } catch (err: any) {
        console.error('Failed to load sandbox actions:', err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadSandboxActions()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  const shortenHash = (hash: string | number) => {
    if (!hash) return 'N/A'
    if (typeof hash === 'number') return hash.toString()
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-32">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            <span className="text-black dark:text-white">Test Drive </span>
            <span className="text-purple-600 dark:text-purple-400">Before You Buy</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 font-medium max-w-2xl mx-auto">
            Try the $1 USDC data refresh for free in our virtual environment. No wallet signature, no payment required.
          </p>
        </div>

        <div className="card p-8 mb-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-start space-x-4 mb-6">
            <div className="flex-shrink-0">
              <svg className="w-10 h-10 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-black text-purple-900 dark:text-purple-100 mb-3">
                Why Use the Sandbox?
              </h2>
              <div className="space-y-3 text-gray-700 dark:text-gray-300">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-base"><strong className="font-bold">Risk-free testing:</strong> Preview exactly what happens when you refresh data. No money spent, no blockchain transaction.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-base"><strong className="font-bold">Build confidence:</strong> See the process work before committing your USDC</p>
                </div>
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-base"><strong className="font-bold">Verify on blockchain:</strong> Each test is recorded on Sepolia testnet with real blockchain proof at no cost</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-6 border-t border-purple-200 dark:border-purple-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Powered by <a href="https://www.evvm.org/" target="_blank" rel="noopener noreferrer" className="text-purple-600 dark:text-purple-400 hover:underline font-semibold">EVVM</a> (Ethereum Virtual Virtual Machine), virtual blockchain technology that lets you test actions without spending gas or moving real funds.
            </p>
            <a 
              href="https://www.evvm.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold"
            >
              <span>Learn more about EVVM virtual blockchains</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {isLoading ? (
          <div className="card p-12 text-center">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading sandbox actions...</p>
          </div>
        ) : error ? (
          <div className="card p-8 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center space-x-3 mb-2">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-bold text-red-900 dark:text-red-100">Error Loading Sandbox Actions</h3>
            </div>
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        ) : actions.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-3xl flex items-center justify-center mx-auto shadow-2xl mb-6">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
              </svg>
            </div>
            <h3 className="text-3xl font-black text-black dark:text-white mb-3">Ready to Try It?</h3>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Run your first free test to see exactly how the data refresh works. No payment, no risk.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <a href="/app" className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors shadow-lg hover:shadow-xl flex items-center space-x-2">
                <span>Try Free Test Now</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-6">
              Takes less than 10 seconds • No wallet connection required for sandbox
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-2xl font-black text-black dark:text-white mb-2">
                Your Test History
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {actions.length} {actions.length === 1 ? 'test run' : 'test runs'} completed. Each one proved the system works without risking real money.
              </p>
            </div>

            {actions.map((action) => (
              <div key={action.id} className="card p-6 hover:shadow-xl transition-shadow border-l-4 border-l-purple-500">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-4">
                      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-xs font-bold rounded-full uppercase tracking-wide">
                        ✓ Test Run
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(action.created_at)}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-black dark:text-white mb-4">
                      Data Refresh Preview
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-black dark:text-white">Simulated Price</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{action.metadata?.amount || '$1.00 USDC'} (not charged)</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-black dark:text-white">Blockchain Verified</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Recorded on Sepolia testnet • Test ID #{action.evvm_intent_id}</p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold text-black dark:text-white">Security Check</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{shortenHash(action.async_nonce)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 lg:min-w-[200px]">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${action.sepolia_tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-black dark:text-white font-semibold rounded-lg text-sm transition-colors text-center flex items-center justify-center space-x-2"
                    >
                      <span>View Proof</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-semibold text-green-800 dark:text-green-200">
                          $0.00 spent
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
