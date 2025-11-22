export type EVVMMirrorResponse = {
  success: boolean;
  evvmIntentId: number;
  sepoliaTxHash: string;
  asyncNonce: string;
  executorAddress: string;
  actionHash: string;
  opportunityId: string;
  metadata: {
    amount: string;
    network: string;
    timestamp: string;
    datasetItems: number;
    opportunityId: string;
  };
  explorerUrl: string;
}

export type EVVMSandboxAction = {
  id: string;
  opportunity_id: string;
  action_hash: string;
  async_nonce: string;
  executor_address: string;
  sepolia_tx_hash: string;
  evvm_intent_id: number;
  user_address: string | null;
  metadata: {
    amount: string;
    network: string;
    timestamp: string;
    datasetItems: number;
    opportunityId: string;
  };
  created_at: string;
}

const getSupabaseUrl = () => {
  const envUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  if (envUrl) {
    return envUrl;
  }
  return 'http://localhost:54321';
};

export async function mirrorDatasetRefresh(
  walletAddress?: string,
  opportunityId?: string
): Promise<EVVMMirrorResponse> {
  const supabaseUrl = getSupabaseUrl();
  
  const response = await fetch(`${supabaseUrl}/functions/v1/evvm-mirror-dataset-refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      walletAddress,
      opportunityId 
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to mirror action to EVVM sandbox');
  }

  return response.json();
}

export interface EVVMAPI {
  mirrorDatasetRefresh: (walletAddress?: string, opportunityId?: string) => Promise<EVVMMirrorResponse>;
}

export const evvmAPI: EVVMAPI = {
  mirrorDatasetRefresh,
};
