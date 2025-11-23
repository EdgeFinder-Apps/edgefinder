// Initiates payment flow by getting requirements from facilitator

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StartRequest {
  walletAddress: string;
}

interface RequirementsResponse {
  network: string;
  token: string;
  recipient: string;
  amount: string;
  nonce: string;
  deadline: number;
}

function validateWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function createDevBypassResponse() {
  const nonce = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  
  return {
    x402Version: 1,
    error: 'Payment required',
    accepts: [{
      scheme: 'exact',
      network: 'arbitrum',
      maxAmountRequired: '1000000',
      asset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC address on Arbitrum
      payTo: '0x0000000000000000000000000000000000000000',
      resource: 'http://localhost:54321/functions/v1/x402-status',
      description: 'EdgeFinder data access',
      mimeType: 'application/json',
      maxTimeoutSeconds: 3600,
      extra: {
        feeMode: 'facilitator_split',
        feeBps: 250,
        gasBufferWei: '100000',
        nonce: nonce,
        deadline: deadline,
        merchantAddress: '0x0000000000000000000000000000000000000000'
      }
    }]
  };
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
    const { walletAddress }: StartRequest = await req.json();

    // Validate wallet address
    if (!walletAddress || !validateWalletAddress(walletAddress)) {
      return new Response(
        JSON.stringify({ error: "Invalid wallet address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting payment flow for wallet: ${walletAddress}`);

    // Check for dev bypass
    const url = new URL(req.url);
    const devBypass = url.searchParams.get('dev_bypass');
    const nodeEnv = Deno.env.get('NODE_ENV');
    const devBypassSecret = Deno.env.get('DEV_BYPASS_SECRET');

    if (nodeEnv !== 'production' && devBypass && devBypass === devBypassSecret) {
      console.log('Using dev bypass mode');
      const devResponse = createDevBypassResponse();
      const acceptsItem = devResponse.accepts[0];
      const requirements: RequirementsResponse = {
        network: acceptsItem.network,
        token: acceptsItem.asset,
        recipient: acceptsItem.payTo,
        amount: acceptsItem.maxAmountRequired,
        nonce: acceptsItem.extra?.nonce || '',
        deadline: acceptsItem.extra?.deadline || Date.now() + 3600000,
      };
      
      return new Response(
        JSON.stringify(requirements),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get facilitator configuration
    const facilitatorApiUrl = Deno.env.get('FACILITATOR_API_URL');
    const merchantAddress = Deno.env.get('MERCHANT_ADDRESS');

    if (!facilitatorApiUrl || !merchantAddress) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate the total amount including facilitator fees
    const merchantAmount = 900000n;
    const serviceFee = (merchantAmount * 50n) / 10000n;
    const gasFee = 100000n;
    const totalAmount = merchantAmount + serviceFee + gasFee;
    
    // Call facilitator requirements endpoint
    const facilitatorRequest = {
      amount: totalAmount.toString(),
      memo: 'EdgeFinder data access',
      network: 'arbitrum',
      token: 'USDC',
      extra: {
        merchantAddress: merchantAddress
      }
    };

    console.log('Calling facilitator requirements endpoint:', facilitatorApiUrl);
    
    const facilitatorResponse = await fetch(`${facilitatorApiUrl}/requirements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(facilitatorRequest),
    });

    if (!facilitatorResponse.ok && facilitatorResponse.status !== 402) {
      const errorText = await facilitatorResponse.text();
      console.error('Facilitator error:', errorText);
      return new Response(
        JSON.stringify({ error: "Failed to get payment requirements" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const facilitatorData = await facilitatorResponse.json();
    console.log('Facilitator response:', facilitatorData);

    if (facilitatorData.accepts && facilitatorData.accepts.length > 0) {
      const acceptsItem = facilitatorData.accepts[0];
      if (acceptsItem.network !== 'arbitrum') {
        console.error('Invalid network in facilitator response:', acceptsItem.network);
        return new Response(
          JSON.stringify({ error: "Currently only Arbitrum is supported for settlement" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const requirements: RequirementsResponse = {
        network: acceptsItem.network,
        token: acceptsItem.asset,
        recipient: acceptsItem.payTo,
        amount: acceptsItem.maxAmountRequired,
        nonce: acceptsItem.extra?.nonce || '',
        deadline: acceptsItem.extra?.deadline || Date.now() + 3600000,
      };
      
      console.log('Generated requirements with nonce:', {
        nonce: requirements.nonce,
        deadline: requirements.deadline,
        amount: requirements.amount
      });

      return new Response(
        JSON.stringify(requirements),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      console.error('Invalid facilitator response format');
      return new Response(
        JSON.stringify({ error: "Invalid response from payment facilitator" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error('x402-start error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
