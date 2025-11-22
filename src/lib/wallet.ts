import { http, createConfig } from 'wagmi'
import { arbitrum, mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [arbitrum, mainnet],
  connectors: [
    injected(),
  ],
  transports: {
    [arbitrum.id]: http(),
    [mainnet.id]: http(),
  },
})

export const MOCK_ADDRESS = '0x0000000000000000000000000000000000000DEV' as const

export function isMockWallet(address: string | undefined): boolean {
  return address === MOCK_ADDRESS
}
