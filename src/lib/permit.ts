import { type Address, type WalletClient, toHex } from 'viem'
import { arbitrum } from 'viem/chains'
import type { PaymentRequirements, Permit } from './payments'

// USDC contract address on Arbitrum One
export const USDC_ARBITRUM_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address

// EIP-3009 domain separator for USDC on Arbitrum
const EIP3009_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: arbitrum.id,
  verifyingContract: USDC_ARBITRUM_ADDRESS,
} as const

// EIP-3009 transferWithAuthorization type with display hint
const TRANSFER_WITH_AUTHORIZATION_TYPE = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256', display: 'USDC' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

function generateNonce(): string {
  // generate a random 32-byte nonce
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

export async function createPermit(
  walletClient: WalletClient,
  requirements: PaymentRequirements
): Promise<Permit> {
  if (!walletClient.account) {
    throw new Error('Wallet client must have an account')
  }

  if (requirements.network !== 'arbitrum') {
    throw new Error('Only Arbitrum network is supported')
  }

  const chainId = await walletClient.getChainId()
  if (chainId !== arbitrum.id) {
    throw new Error(`Must be connected to Arbitrum One (chain ID ${arbitrum.id}), currently on ${chainId}`)
  }

  const from = walletClient.account.address
  const to = requirements.recipient as Address
  const value = BigInt(requirements.amount)
  const validAfter = 0
  const validBefore = BigInt(requirements.deadline)
  
  const nonce = requirements.nonce && requirements.nonce !== 'dev' 
    ? requirements.nonce as `0x${string}`
    : generateNonce() as `0x${string}`

  const formattedValue = formatUSDCAmount(value.toString())

  const typedData = {
    domain: EIP3009_DOMAIN,
    types: TRANSFER_WITH_AUTHORIZATION_TYPE,
    primaryType: 'TransferWithAuthorization' as const,
    message: {
      from,
      to,
      value,
      validAfter: BigInt(validAfter),
      validBefore,
      nonce,
    },
    display: {
      value: `${formattedValue} USDC`,
    },
  }

  try {
    const signature = await walletClient.signTypedData({
      account: walletClient.account,
      ...typedData,
    })
    
    const permit: Permit = {
      owner: from,
      spender: to,
      value: value.toString(),
      deadline: Number(validBefore),
      nonce: nonce,
      sig: signature,
    }

    return permit
  } catch (error: any) {
    console.error('Failed to create permit:', error)
    throw new Error(`Failed to sign permit: ${error.message}`)
  }
}

// function to validate USDC token address
export function validateUSDCToken(tokenAddress: string): boolean {
  return tokenAddress.toLowerCase() === USDC_ARBITRUM_ADDRESS.toLowerCase()
}

// function to format amount for display
export function formatUSDCAmount(microAmount: string): string {
  const amount = BigInt(microAmount)
  const dollars = amount / 1000000n
  const cents = (amount % 1000000n) / 10000n
  return `$${dollars}.${cents.toString().padStart(2, '0')}`
}
