import { useState, useEffect, useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useWalletClient } from 'wagmi'
import { useWallet } from '../context/WalletContext'
import { storage } from '../lib/storage'
import { startPayment, settlePayment, getPaymentStatus, getNextPipelineRun, type PaymentStatus } from '../lib/payments'
import { createPermit } from '../lib/permit'
import { mirrorDatasetRefresh, type EVVMMirrorResponse } from '../lib/evvm'
import { UserDataset, MatchedEvent } from '../types'
import { Countdown } from '../components/Countdown'
import { OpportunityCard } from '../components/OpportunityCard'
import { getOpportunityAnalytics } from '../lib/amp'

type SortOption = 'endDateAsc' | 'endDateDesc' | 'roiAsc' | 'roiDesc' | 'ampScoreDesc'

export function Dashboard() {
  const { address, isConnected } = useWallet()
  const { data: walletClient } = useWalletClient()
  const [dataset, setDataset] = useState<UserDataset | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [canRefresh, setCanRefresh] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('endDateAsc')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [nextPipelineRun, setNextPipelineRun] = useState<Date>(getNextPipelineRun())
  const [isLoadingSandbox, setIsLoadingSandbox] = useState(false)
  const [sandboxResult, setSandboxResult] = useState<EVVMMirrorResponse | null>(null)
  const [ampScores, setAmpScores] = useState<Record<string, number>>({})

  // load dataset and payment status on mount
  useEffect(() => {
    const loadData = async () => {
      // load stored dataset
      const stored = storage.getUserDataset()
      setDataset(stored)
      
      // load payment status from server if wallet is connected
      if (address) {
        try {
          const status = await getPaymentStatus(address)
          setPaymentStatus(status)
          
          // load dataset from server if available and more recent
          if (status.dataset && status.entitlement?.is_valid) {
            const serverDataset = {
              items: status.dataset.items,
              fetchedAtISO: new Date().toISOString(),
              nextAvailableAtISO: status.dataset.next_available_at,
            }
            setDataset(serverDataset)
            storage.setUserDataset(serverDataset)
          }
          
          // set refresh availability based on entitlement expiration
          console.log('Payment status:', {
            hasEntitlement: !!status.entitlement,
            isValid: status.entitlement?.is_valid,
            validUntil: status.entitlement?.valid_until,
            canRefresh: !status.entitlement?.is_valid
          })
          setCanRefresh(!status.entitlement?.is_valid)
        } catch (error) {
          console.error('Failed to load payment status:', error)
          // fall back to local storage logic
          if (stored) {
            const now = new Date().getTime()
            const nextAvailable = new Date(stored.nextAvailableAtISO).getTime()
            setCanRefresh(now >= nextAvailable)
          } else {
            setCanRefresh(true)
          }
        }
      } else {
        // no wallet connected, use local storage
        if (stored) {
          const now = new Date().getTime()
          const nextAvailable = new Date(stored.nextAvailableAtISO).getTime()
          setCanRefresh(now >= nextAvailable)
        } else {
          setCanRefresh(true)
        }
      }
    }

    loadData()
  }, [address])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (dataset?.items && sortBy === 'ampScoreDesc') {
      const fetchAmpScores = async () => {
        const scores: Record<string, number> = {}
        for (const item of dataset.items) {
          try {
            const analytics = await getOpportunityAnalytics(item.id, 24, 5.0)
            if (analytics.has_data && analytics.analytics) {
              scores[item.id] = analytics.analytics.amp_edge_score
            }
          } catch (err) {
            console.error(`Failed to fetch Amp score for ${item.id}:`, err)
          }
        }
        setAmpScores(scores)
      }
      fetchAmpScores()
    }
  }, [dataset, sortBy])

  const sortedOpportunities = useMemo(() => {
    if (!dataset) return [];
    
    return [...dataset.items].sort((a, b) => {
      const aEndDate = new Date(a.endDateISO).getTime()
      const bEndDate = new Date(b.endDateISO).getTime()
      
      // Calculate ROI for each event
      const calculateRoi = (event: MatchedEvent) => {
        if (!event?.polymarket?.yesPrice || !event?.kalshi?.yesPrice) {
          return 0;
        }
        const option1 = event.polymarket.yesPrice + event.kalshi.noPrice
        const option2 = event.kalshi.yesPrice + event.polymarket.noPrice
        const bestCost = Math.min(option1, option2)
        return bestCost < 1.0 ? (1.0 - bestCost) * 100 : 0
      }
      
      const aRoi = calculateRoi(a)
      const bRoi = calculateRoi(b)
      
      switch (sortBy) {
        case 'endDateAsc':
          return aEndDate - bEndDate
        case 'endDateDesc':
          return bEndDate - aEndDate
        case 'roiAsc':
          return aRoi - bRoi
        case 'roiDesc':
          return bRoi - aRoi
        case 'ampScoreDesc':
          const aScore = ampScores[a.id] || 0
          const bScore = ampScores[b.id] || 0
          return bScore - aScore
        default:
          return 0
      }
    });
  }, [dataset, sortBy, ampScores]);

  const handleRefreshClick = async () => {
    if (!canRefresh) return
    // trigger a fresh payment flow to get new data
    await handlePayment()
  }

  const handlePayment = async () => {
    setShowPaymentModal(false)
    setIsLoading(true)
    setTxHash(null)

    try {
      if (!address) {
        showToast('Please connect your wallet first', 'error')
        setIsLoading(false)
        return
      }

      showToast('Starting payment flow...', 'success')
      const requirements = await startPayment(address)
      
      if (walletClient) {
        showToast('Please sign the permit in your wallet...', 'success')
        const permit = await createPermit(walletClient, requirements)
        
        showToast('Processing payment...', 'success')
        const result = await settlePayment(address, requirements, permit)
        
        const newDataset = {
          items: result.dataset.items,
          fetchedAtISO: new Date().toISOString(),
          nextAvailableAtISO: result.dataset.next_available_at,
        }
        
        setDataset(newDataset)
        storage.setUserDataset(newDataset)
        setCanRefresh(false)
        setTxHash(result.entitlement.tx_hash)
        
        const status = await getPaymentStatus(address)
        setPaymentStatus(status)

        showToast('Payment successful! Data refreshed.', 'success')
      } else {
        showToast('Wallet client not available. Please try reconnecting.', 'error')
      }
    } catch (error: any) {
      console.error('Payment error:', error)
      showToast(error.message || 'Payment failed. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCountdownComplete = () => {
    setCanRefresh(true)
    setNextPipelineRun(getNextPipelineRun())
  }

  const handleSandboxPreview = async () => {
    setIsLoadingSandbox(true)
    setSandboxResult(null)

    try {
      showToast('Creating sandbox preview...', 'success')
      const result = await mirrorDatasetRefresh(address)
      
      setSandboxResult(result)
      showToast('Preview saved to Sandbox!', 'success')
      
      setTimeout(() => {
        setSandboxResult(null)
      }, 10000)
    } catch (error: any) {
      console.error('Sandbox preview error:', error)
      showToast(error.message || 'Failed to create sandbox preview', 'error')
    } finally {
      setIsLoadingSandbox(false)
    }
  }

  if (!isConnected) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-32">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            <span className="text-black dark:text-white">Trading </span>
            <span className="neon-text">Dashboard</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 font-medium">
            Monitor live arbitrage opportunities across prediction markets
          </p>
        </div>

        <div className="card p-8 mb-12 neon-glow">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="space-y-6">
              {dataset ? (
                <>
                  <div>
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                      <h2 className="text-2xl font-black text-black dark:text-white">
                        DATA ACCESS ACTIVE
                      </h2>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium text-lg">
                      Found <span className="neon-text font-bold">{dataset.items.length}</span> matched events
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                      Last updated: {new Date(dataset.fetchedAtISO).toLocaleTimeString()} • 
                      Access expires: {paymentStatus?.entitlement?.valid_until 
                        ? new Date(paymentStatus.entitlement.valid_until).toLocaleTimeString()
                        : new Date(dataset.nextAvailableAtISO).toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                      Refresh data: ~$1.0045 USDC
                    </p>
                    {txHash && txHash !== 'dev-bypass' && (
                      <p className="text-sm text-cyan-600 dark:text-cyan-400 mt-2">
                        Transaction: <a 
                          href={`https://arbiscan.io/tx/${txHash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline hover:text-cyan-500"
                        >
                          {txHash.slice(0, 10)}...{txHash.slice(-8)}
                        </a>
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-2xl font-black text-gray-600 dark:text-gray-400 mb-3">
                      NO ACTIVE ACCESS
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 font-medium text-lg">
                      Pay <span className="neon-text font-bold">$1 USDC</span> to unlock live opportunities
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={dataset && canRefresh ? handleRefreshClick : handlePayment}
                  disabled={isLoading || (dataset && !canRefresh)}
                  className={`btn-neon ${
                    (dataset && !canRefresh) || isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : dataset ? (
                    canRefresh ? (
                      'Refresh Data'
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span>Next update in</span>
                        <Countdown 
                          targetISO={nextPipelineRun.toISOString()} 
                          onComplete={handleCountdownComplete}
                        />
                      </div>
                    )
                  ) : (
                    'Unlock Data'
                  )}
                </button>

                <button
                  onClick={handleSandboxPreview}
                  disabled={isLoadingSandbox || isLoading}
                  className={`px-6 py-3 rounded-xl font-bold transition-all duration-200 flex-shrink-0 ${
                    isLoadingSandbox || isLoading
                      ? 'bg-gray-400 dark:bg-gray-700 text-gray-200 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg hover:shadow-purple-500/50 border-2 border-purple-500'
                  }`}
                >
                  {isLoadingSandbox ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Test...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Try for Free</span>
                      </div>
                      <span className="text-xs bg-purple-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">No funds needed</span>
                    </div>
                  )}
                </button>
              </div>
              
              <div className="flex items-start gap-2 pl-1">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong className="text-purple-700 dark:text-purple-400 font-semibold">New to the platform?</strong> Test the data refresh process for free first. No payment, no risk.
                </p>
              </div>
            </div>
          </div>
        </div>

        {dataset && dataset.items.length > 0 ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-black">
                  <span className="neon-text">{dataset.items.length}</span>
                  <span className="text-black dark:text-white"> Opportunities</span>
                </h2>
                <div className="badge bg-cyan-400 text-black neon-glow">
                  LIVE
                </div>
              </div>
              <div className="relative w-full sm:w-64">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-4 py-2 pr-10 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-transparent appearance-none"
                >
                  <option value="endDateAsc">End Date (Earliest First)</option>
                  <option value="endDateDesc">End Date (Latest First)</option>
                  <option value="roiDesc">ROI % (High to Low)</option>
                  <option value="roiAsc">ROI % (Low to High)</option>
                  <option value="ampScoreDesc">Quality Score (High to Low)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-4 mb-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Markets move fast!</strong> Prices can change in seconds. Always verify current prices on the platform before trading.
              </p>
            </div>
            
            <div className="grid gap-6">
              {sortedOpportunities.map((event) => (
                <OpportunityCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        ) : (
          !isLoading && (
            <div className="card p-12 sm:p-16 text-center">
              <div className="max-w-md mx-auto space-y-6">
                <div className="w-20 h-20 bg-gradient-to-br from-sky-500 to-sky-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                  <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">No Data Yet</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Start discovering arbitrage opportunities by refreshing the data
                  </p>
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="card p-8 max-w-md w-full animate-slide-up">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl mx-auto mb-6 shadow-xl">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-center">Confirm Payment</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
              You will be charged <strong className="text-sky-600 dark:text-sky-400">$1 USDC</strong> on Arbitrum to refresh the data. 
              The new dataset will be available for 1 hour.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handlePayment}
                className="btn-primary flex-1"
              >
                <span className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Confirm</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className={`card p-4 flex items-center space-x-3 shadow-xl min-w-[300px] ${
            toast.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700' 
              : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
          }`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
              toast.type === 'success'
                ? 'bg-green-500'
                : 'bg-red-500'
            }`}>
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <span className={`font-medium ${
              toast.type === 'success' 
                ? 'text-green-900 dark:text-green-100' 
                : 'text-red-900 dark:text-red-100'
            }`}>
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {sandboxResult && (
        <div className="fixed bottom-20 right-4 z-50 animate-slide-up max-w-sm">
          <div className="card p-5 bg-gradient-to-br from-purple-50 to-green-50 dark:from-purple-900/30 dark:to-green-900/20 border-purple-300 dark:border-purple-700 shadow-xl">
            <div className="flex items-start space-x-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-green-500 shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-purple-900 dark:text-purple-100 mb-1 text-lg">
                  Test Successful!
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  Your free test run is complete. This is how the real refresh works, but with $0 spent.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">Test ID: <span className="font-mono font-semibold text-purple-700 dark:text-purple-300">#{sandboxResult.evvmIntentId}</span></span>
                  </div>
                  <a 
                    href={sandboxResult.explorerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold"
                  >
                    <span>View blockchain proof</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-purple-200 dark:border-purple-700">
              <a 
                href="/sandbox"
                className="block w-full text-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm transition-colors"
              >
                View All Test History
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
