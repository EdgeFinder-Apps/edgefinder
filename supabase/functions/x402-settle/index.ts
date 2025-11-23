// Settles payment with facilitator and creates dataset snapshot
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface SettleRequest {
  walletAddress: string;
  requirements: {
    network: string;
    token: string;
    recipient: string;
    amount: string;
    nonce: string;
    deadline: number;
  };
  permit: {
    owner: string;
    spender: string;
    value: string;
    deadline: number;
    nonce: string;
    sig: string;
  };
  dev_bypass?: string;
}

interface ArbitrageOpportunity {
  id: string;
  polymarket_market: any;
  kalshi_market: any;
  profit_usd: number;
  profit_percentage: number;
  created_at: string;
}

function validateWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function getLatestSharedDataset(supabase: any) {
  console.log('Fetching latest shared dataset');
  
  // check if there's an unexpired dataset
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
    const dataset = activeData[0];
    console.log(`Found active shared dataset with ${dataset.items?.length || 0} items, expires at ${dataset.expires_at}`);
    return dataset;
  }

  // if no active dataset, get most recent expired dataset
  console.log('No active dataset found, getting most recent expired dataset');
  const { data: expiredData, error: expiredError } = await supabase
    .from('shared_datasets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (expiredError) {
    console.error('Error fetching expired shared dataset:', expiredError);
    throw new Error(`Failed to fetch shared dataset: ${expiredError.message}`);
  }

  if (!expiredData || expiredData.length === 0) {
    throw new Error('No shared dataset available. Pipeline may not have run yet.');
  }

  const dataset = expiredData[0];
  console.log(`Using expired dataset with ${dataset.items?.length || 0} items, expired at ${dataset.expires_at}`);
  
  return dataset;
}

async function grantDatasetAccess(supabase: any, walletAddress: string, sharedDatasetId: string, txHash: string, facilitatorResponse: any) {
  console.log(`Granting access to shared dataset ${sharedDatasetId} for ${walletAddress}`);
  
  // get shared dataset to figure out expiration
  const { data: sharedDatasetData, error: datasetError } = await supabase
    .from('shared_datasets')
    .select('expires_at')
    .eq('id', sharedDatasetId)
    .limit(1);

  if (datasetError || !sharedDatasetData || sharedDatasetData.length === 0) {
    throw new Error('Failed to get shared dataset expiration');
  }

  const sharedDataset = sharedDatasetData[0];

  const { data: entitlement, error: entitlementError } = await supabase
    .from('entitlements')
    .insert({
      wallet_address: walletAddress,
      shared_dataset_id: sharedDatasetId,
      tx_hash: txHash,
      facilitator_response: facilitatorResponse,
      valid_until: sharedDataset.expires_at,
    })
    .select()
    .single();

  if (entitlementError) {
    console.error('Error creating entitlement:', entitlementError);
    throw new Error(`Failed to create entitlement: ${entitlementError.message}`);
  }

  console.log(`Access granted, entitlement ID: ${entitlement.id}`);
  return entitlement;
}

async function createEntitlement(
  supabase: any, 
  walletAddress: string, 
  datasetId: string, 
  txHash: string, 
  facilitatorResponse?: any
) {
  console.log(`Creating entitlement for ${walletAddress}, dataset ${datasetId}, tx ${txHash}`);
  
  const { data: entitlement, error: entitlementError } = await supabase
    .from('entitlements')
    .insert({
      wallet_address: walletAddress,
      dataset_id: datasetId,
      tx_hash: txHash,
      facilitator_response: facilitatorResponse,
      valid_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    })
    .select()
    .single();

  if (entitlementError) {
    console.error('Error creating entitlement:', entitlementError);
    throw new Error(`Failed to create entitlement: ${entitlementError.message}`);
  }

  return entitlement;
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
    const { walletAddress, requirements, permit, dev_bypass }: SettleRequest = await req.json();

    // Validate wallet address
    if (!walletAddress || !validateWalletAddress(walletAddress)) {
      return new Response(
        JSON.stringify({ error: "Invalid wallet address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Settling payment for wallet: ${walletAddress}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for dev bypass
    const nodeEnv = Deno.env.get('NODE_ENV');
    const devBypassSecret = Deno.env.get('DEV_BYPASS_SECRET');

    if (nodeEnv !== 'production' && dev_bypass && dev_bypass === devBypassSecret) {
      console.log('Using dev bypass mode for settlement');
      
      // Get latest shared dataset and grant access
      const sharedDataset = await getLatestSharedDataset(supabase);
      const entitlement = await grantDatasetAccess(supabase, walletAddress, sharedDataset.id, 'dev-bypass', null);

      return new Response(
        JSON.stringify({ 
          dataset: {
            items: sharedDataset.items,
            next_available_at: sharedDataset.expires_at
          },
          entitlement 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get facilitator configuration
    const facilitatorApiUrl = Deno.env.get('FACILITATOR_API_URL');
    const facilitatorApiKey = Deno.env.get('FACILITATOR_API_KEY');

    console.log('Environment check:', {
      hasApiUrl: !!facilitatorApiUrl,
      hasApiKey: !!facilitatorApiKey,
      apiKeyLength: facilitatorApiKey?.length || 0,
      apiKeyPrefix: facilitatorApiKey?.substring(0, 8) || 'none'
    });

    if (!facilitatorApiUrl || !facilitatorApiKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse signature to extract v, r, s components
    const signature = permit.sig;
    const r = signature.slice(0, 66); // 0x + 64 chars
    const s = '0x' + signature.slice(66, 130); // next 64 chars
    const v = parseInt(signature.slice(130, 132), 16); // last 2 chars

    // Get merchant address from environment
    const merchantAddress = Deno.env.get('MERCHANT_ADDRESS');

    // Build request for facilitator API
    const facilitatorRequest = {
      network: requirements.network,
      token: requirements.token,
      recipient: requirements.recipient,
      amount: requirements.amount,
      nonce: permit.nonce,
      deadline: requirements.deadline,
      extra: {
        merchantAddress: merchantAddress
      },
      permit: {
        owner: permit.owner,
        spender: permit.spender,
        value: permit.value,
        deadline: permit.deadline,
        nonce: permit.nonce,
        sig: permit.sig
      },
      paymentPayload: {
        scheme: "exact",
        network: requirements.network,
        payload: {
          from: permit.owner,
          to: permit.spender,
          value: permit.value,
          validAfter: 0,
          validBefore: permit.deadline,
          nonce: permit.nonce,
          v: v,
          r: r,
          s: s
        }
      },
      paymentRequirements: {
        scheme: "exact",
        network: requirements.network,
        token: requirements.token,
        amount: requirements.amount,
        recipient: requirements.recipient,
        description: "EdgeFinder data access",
        maxTimeoutSeconds: 3600
      }
    };

    console.log('Calling facilitator settle endpoint');
    console.log('Full requirements received:', JSON.stringify(requirements, null, 2));
    console.log('Full permit received:', JSON.stringify(permit, null, 2));
    console.log('Facilitator request:', JSON.stringify(facilitatorRequest, null, 2));
    
    // retry with backoff if transient errors occur
    const maxRetries = 4;
    const baseRetryDelay = 1000;
    let facilitatorResponse: Response | undefined;
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries} to call facilitator`);
        
        facilitatorResponse = await fetch(`${facilitatorApiUrl}/settle`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': facilitatorApiKey,
          },
          body: JSON.stringify(facilitatorRequest),
        });
        
        // If good response, break
        if (facilitatorResponse.ok) {
          console.log('Facilitator call succeeded');
          break;
        }
        
        // Check if it's a retryable error
        const errorText = await facilitatorResponse.text();
        const statusCode = facilitatorResponse.status;
        
        // Nonce errors and database errors are retryable
        const isNonceError = errorText.includes('nonce uniqueness') || 
                            errorText.includes('checking nonce');
        const isDatabaseError = errorText.includes('database') || 
                               errorText.includes('Internal error');
        const isServerError = statusCode >= 500;
        
        const isRetryable = isServerError || isNonceError || isDatabaseError;
        
        console.log(`Attempt ${attempt} failed with status ${statusCode}`, {
          isRetryable,
          isNonceError,
          isDatabaseError,
          errorPreview: errorText.substring(0, 150)
        });
        
        if (!isRetryable || attempt === maxRetries) {
          // Not retryable or last attempt, return the response
          facilitatorResponse = new Response(errorText, {
            status: statusCode,
            statusText: facilitatorResponse.statusText,
            headers: facilitatorResponse.headers
          });
          break;
        }
        
        // Wait before retry with exponential backoff
        const retryDelay = baseRetryDelay * Math.pow(2, attempt - 1);
        console.log(`Retryable error detected, waiting ${retryDelay}ms before retry ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
      } catch (fetchError: any) {
        lastError = fetchError;
        console.error(`Network error on attempt ${attempt}:`, {
          error: fetchError.message,
          type: fetchError.name
        });
        
        if (attempt === maxRetries) {
          return new Response(
            JSON.stringify({ 
              error: "Network error connecting to payment facilitator",
              details: "The facilitator service may be experiencing connectivity issues. Please try again in a few moments."
            }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        const retryDelay = baseRetryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!facilitatorResponse) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to connect to payment facilitator",
          details: "Unable to reach the facilitator service after multiple attempts. Please try again later."
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!facilitatorResponse.ok) {
      const errorText = await facilitatorResponse.text();
      const statusCode = facilitatorResponse.status;
      
      console.error('Facilitator settle error:', {
        status: statusCode,
        statusText: facilitatorResponse.statusText,
        response: errorText,
        headers: Object.fromEntries(facilitatorResponse.headers.entries())
      });
      
      let errorMessage = "Payment settlement failed";
      let errorDetails = errorText;
      
      if (statusCode === 401) {
        if (errorText.includes("Invalid API key")) {
          errorMessage = "Authentication issue with payment facilitator";
          errorDetails = "The facilitator rejected the API key. This could be due to network issues preventing cache refresh. Please try again in 60 seconds.";
        }
      } else if (statusCode === 400) {
        if (errorText.includes("nonce uniqueness") || errorText.includes("checking nonce")) {
          errorMessage = "Payment processing temporarily unavailable";
          errorDetails = "The payment facilitator is experiencing a temporary database issue. This has been automatically retried. Please wait a few seconds and try again.";
        } else if (errorText.includes("nonce")) {
          errorMessage = "Payment nonce error";
          errorDetails = "The payment nonce may have been reused. Please refresh the page and try again with a new payment request.";
        }
      } else if (statusCode >= 500) {
        errorMessage = "Payment facilitator service error";
        errorDetails = "The facilitator service is experiencing issues. Please try again later.";
      } else if (statusCode === 503 || statusCode === 504) {
        errorMessage = "Payment facilitator timeout";
        errorDetails = "The facilitator service is not responding. Please try again later.";
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: errorDetails,
          statusCode: statusCode
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const facilitatorData = await facilitatorResponse.json();
    console.log('Facilitator settle response:', facilitatorData);

    if (!facilitatorData.success) {
      console.error('Facilitator settlement failed:', facilitatorData.error);
      return new Response(
        JSON.stringify({ error: facilitatorData.error || "Payment settlement failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // On successful settlement, grant access to shared dataset
    console.log('Payment settled successfully, granting access to shared dataset');
    
    const sharedDataset = await getLatestSharedDataset(supabase);
    const txHash = facilitatorData.txHash || facilitatorData.transactionHash || facilitatorData.meta?.incomingTxHash || 'unknown';
    const entitlement = await grantDatasetAccess(supabase, walletAddress, sharedDataset.id, txHash, facilitatorData);

    console.log(`Successfully granted access to shared dataset ${sharedDataset.id}, entitlement ${entitlement.id}`);

    return new Response(
      JSON.stringify({ 
        dataset: {
          items: sharedDataset.items,
          next_available_at: sharedDataset.expires_at
        },
        entitlement 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('x402-settle error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
