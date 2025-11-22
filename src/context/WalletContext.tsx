import { createContext, useContext, useState, ReactNode } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { MOCK_ADDRESS } from '../lib/wallet'

type WalletContextType = {
  address: string | undefined
  isConnected: boolean
  connect: () => void
  disconnect: () => void
  isLoading: boolean
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [mockAddress, setMockAddress] = useState<string | undefined>(undefined)
  
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const { connect: wagmiConnect, isPending } = useConnect()
  const { disconnect: wagmiDisconnect } = useDisconnect()

  const isProduction = (import.meta as any).env.NODE_ENV === 'production'
  const useRealWallet = isProduction || (import.meta as any).env.VITE_USE_REAL_WALLET === 'true'

  const address = useRealWallet ? wagmiAddress : mockAddress
  const isConnected = useRealWallet ? wagmiConnected : !!mockAddress

  const connect = () => {
    if (useRealWallet) {
      wagmiConnect({ connector: injected() })
    } else {
      setMockAddress(MOCK_ADDRESS)
    }
  }

  const disconnect = () => {
    if (useRealWallet) {
      wagmiDisconnect()
    } else {
      setMockAddress(undefined)
    }
  }

  return (
    <WalletContext.Provider 
      value={{
        address,
        isConnected,
        connect,
        disconnect,
        isLoading: isPending,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider')
  }
  return context
}
