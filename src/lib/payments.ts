export type PaymentRequirements = {
  network: string
  token: string
  recipient: string
  amount: string
  nonce: string
  deadline: number
}

export type Permit = {
  owner: string
  spender: string
  value: string
  deadline: number
  nonce: string
  sig: string
}

export type Dataset = {
  id: string
  wallet_address: string
  items: any[]
  created_at: string
  next_available_at: string
}

export type Entitlement = {
  id: string
  wallet_address: string
  dataset_id: string
  tx_hash: string
  facilitator_response?: any
  valid_until: string
  created_at: string
}

export type PaymentStatus = {
  dataset: Dataset | null
  entitlement: {
    id: string
    tx_hash: string
    valid_until: string
    created_at: string
    is_valid: boolean
  } | null
  now: string
  valid_until: string | null
}

const getSupabaseUrl = () => {
  const envUrl = (import.meta as any).env.VITE_SUPABASE_URL
  if (envUrl) {
    return envUrl
  }
  
  // fallback to localhost only if no env var is set
  return 'http://localhost:54321'
}

// get dev bypass secret for local testing
const getDevBypass = () => {
  if ((import.meta as any).env.NODE_ENV !== 'production') {
    return (import.meta as any).env.VITE_DEV_BYPASS_SECRET
  }
  return null
}

export async function startPayment(walletAddress: string): Promise<PaymentRequirements> {
  const supabaseUrl = getSupabaseUrl()
  const devBypass = getDevBypass()
  
  let url = `${supabaseUrl}/functions/v1/x402-start`
  if (devBypass) {
    url += `?dev_bypass=${devBypass}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to start payment')
  }

  return response.json()
}

export async function settlePayment(
  walletAddress: string, 
  requirements: PaymentRequirements, 
  permit: Permit
): Promise<{ dataset: Dataset; entitlement: Entitlement }> {
  const supabaseUrl = getSupabaseUrl()
  const devBypass = getDevBypass()

  const body: any = {
    walletAddress,
    requirements,
    permit,
  }

  if (devBypass) {
    body.dev_bypass = devBypass
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/x402-settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to settle payment')
  }

  return response.json()
}

// calculate next hourly pipeline run time
export function getNextPipelineRun(): Date {
  const now = new Date()
  const nextRun = new Date(now)
  nextRun.setMinutes(0, 0, 0)
  
  // if we're past the top of the hour, move to next hour
  if (now.getMinutes() > 0 || now.getSeconds() > 0) {
    nextRun.setHours(nextRun.getHours() + 1)
  }
  
  return nextRun
}

export async function getPaymentStatus(walletAddress: string): Promise<PaymentStatus> {
  const supabaseUrl = getSupabaseUrl()

  const response = await fetch(`${supabaseUrl}/functions/v1/x402-status?walletAddress=${walletAddress}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to get payment status')
  }

  return response.json()
}

export type PaymentRequest = {
  amount: number
  token: string
  chain: string
}

export type PaymentResponse = {
  success: boolean
  transactionHash?: string
  error?: string
}

export async function requestPayment(_req: PaymentRequest): Promise<PaymentResponse> {
  throw new Error('Use startPayment and settlePayment instead of requestPayment')
}

export interface PaymentAPI {
  requestPayment: (req: PaymentRequest) => Promise<PaymentResponse>
  startPayment: (walletAddress: string) => Promise<PaymentRequirements>
  settlePayment: (walletAddress: string, requirements: PaymentRequirements, permit: Permit) => Promise<{ dataset: Dataset; entitlement: Entitlement }>
  getPaymentStatus: (walletAddress: string) => Promise<PaymentStatus>
}

export const paymentAPI: PaymentAPI = {
  requestPayment,
  startPayment,
  settlePayment,
  getPaymentStatus,
}
