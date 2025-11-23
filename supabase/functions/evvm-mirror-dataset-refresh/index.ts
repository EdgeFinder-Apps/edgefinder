import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createWalletClient, http, publicActions, parseEther, keccak256, encodePacked } from "https://esm.sh/viem@2.21.7";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.7/accounts";
import { sepolia } from "https://esm.sh/viem@2.21.7/chains";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVVM_SANDBOX_REGISTRY_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "opportunityId", "type": "string" },
      { "internalType": "bytes32", "name": "actionHash", "type": "bytes32" },
      { "internalType": "uint256", "name": "asyncNonce", "type": "uint256" },
      { "internalType": "address", "name": "user", "type": "address" },
      { "internalType": "string", "name": "metadata", "type": "string" }
    ],
    "name": "recordX402SandboxAction",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

interface MirrorRequest {
  opportunityId?: string;
  walletAddress?: string;
}

interface X402ActionPayload {
  network: string;
  token: string;
  amount: string;
  recipient: string;
  resource: string;
  description: string;
}

function generateAsyncNonce(): bigint {
  return BigInt(Date.now() * 1000 + Math.floor(Math.random() * 1000));
}

function hashX402Action(payload: X402ActionPayload): `0x${string}` {
  const packed = encodePacked(
    ['string', 'string', 'string', 'string', 'string', 'string'],
    [
      payload.network,
      payload.token,
      payload.amount,
      payload.recipient,
      payload.resource,
      payload.description
    ]
  );
  return keccak256(packed);
}

async function getLatestSharedDataset(supabase: any) {
  const { data: activeData, error: activeError } = await supabase
    .from('shared_datasets')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (activeError) {
    console.error('Error fetching active shared dataset:', activeError);
    throw new Error(`Failed to fetch shared dataset: ${activeError.message}`);
  }

  if (activeData && activeData.length > 0) {
    return activeData[0];
  }

  const { data: expiredData, error: expiredError } = await supabase
    .from('shared_datasets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (expiredError || !expiredData || expiredData.length === 0) {
    throw new Error('No shared dataset available');
  }

  return expiredData[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { opportunityId, walletAddress }: MirrorRequest = await req.json();

    if (!opportunityId && !walletAddress) {
      return new Response(
        JSON.stringify({ error: "Either opportunityId or walletAddress is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('EVVM mirror request:', { opportunityId, walletAddress });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sharedDataset = await getLatestSharedDataset(supabase);
    console.log(`Using shared dataset with ${sharedDataset.items?.length || 0} items`);

    const x402Payload: X402ActionPayload = {
      network: "arbitrum",
      token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      amount: "1004500",
      recipient: Deno.env.get('MERCHANT_ADDRESS') || '0x0000000000000000000000000000000000000000',
      resource: `${supabaseUrl}/functions/v1/x402-status`,
      description: "EdgeFinder data access - $1 USDC dataset refresh"
    };

    const actionHash = hashX402Action(x402Payload);
    const asyncNonce = generateAsyncNonce();
    const userAddress = walletAddress || '0x0000000000000000000000000000000000000000';
    
    const metadata = JSON.stringify({
      amount: "$1.00 USDC",
      network: "arbitrum",
      timestamp: new Date().toISOString(),
      datasetItems: sharedDataset.items?.length || 0,
      opportunityId: opportunityId || "general_refresh"
    });

    const sepoliaRpcUrl = Deno.env.get('SEPOLIA_RPC_URL');
    const sepoliaPrivateKey = Deno.env.get('SEPOLIA_PRIVATE_KEY');
    const registryAddress = Deno.env.get('EVVM_SANDBOX_REGISTRY_ADDRESS');

    if (!sepoliaRpcUrl || !sepoliaPrivateKey || !registryAddress) {
      console.error('Missing EVVM configuration');
      return new Response(
        JSON.stringify({ error: "EVVM configuration incomplete. Please set SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY, and EVVM_SANDBOX_REGISTRY_ADDRESS" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = privateKeyToAccount(sepoliaPrivateKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(sepoliaRpcUrl),
    }).extend(publicActions);

    console.log('Calling EVVM Sandbox Registry on Sepolia...');
    
    const { request } = await walletClient.simulateContract({
      address: registryAddress as `0x${string}`,
      abi: EVVM_SANDBOX_REGISTRY_ABI,
      functionName: 'recordX402SandboxAction',
      args: [
        opportunityId || "general_refresh",
        actionHash,
        asyncNonce,
        userAddress as `0x${string}`,
        metadata
      ],
    });

    const txHash = await walletClient.writeContract(request);
    console.log('Sepolia transaction submitted:', txHash);

    const receipt = await walletClient.waitForTransactionReceipt({ hash: txHash });
    console.log('Transaction confirmed:', receipt);

    const intentIdHex = receipt.logs[0]?.topics[1];
    const evvmIntentId = intentIdHex ? parseInt(intentIdHex, 16) : 0;

    const { data: dbRecord, error: dbError } = await supabase
      .from('evvm_sandbox_actions')
      .insert({
        opportunity_id: opportunityId || "general_refresh",
        action_hash: actionHash,
        async_nonce: asyncNonce.toString(),
        executor_address: account.address,
        sepolia_tx_hash: txHash,
        evvm_intent_id: evvmIntentId,
        user_address: userAddress,
        metadata: JSON.parse(metadata)
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving to database:', dbError);
    } else {
      console.log('Saved to database:', dbRecord.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        evvmIntentId,
        sepoliaTxHash: txHash,
        asyncNonce: asyncNonce.toString(),
        executorAddress: account.address,
        actionHash,
        opportunityId: opportunityId || "general_refresh",
        metadata: JSON.parse(metadata),
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('evvm-mirror-dataset-refresh error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
