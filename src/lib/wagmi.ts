import { createConfig, http } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [arbitrum],
  connectors: [
    injected(),
  ],
  transports: {
    [arbitrum.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
