// Returns latest entitlement and dataset for a wallet address

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function validateWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const url = new URL(req.url);
    const walletAddress = url.searchParams.get('walletAddress');

    // Validate wallet address
    if (!walletAddress || !validateWalletAddress(walletAddress)) {
      return new Response(
        JSON.stringify({ error: "Invalid wallet address format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Getting status for wallet: ${walletAddress}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get latest entitlement with associated shared dataset
    const { data: entitlement, error: entitlementError } = await supabase
      .from('entitlements')
      .select(`
        *,
        shared_dataset:shared_datasets(*)
      `)
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (entitlementError && entitlementError.code !== 'PGRST116') {
      console.error('Error fetching entitlement:', entitlementError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch entitlement status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!entitlement) {
      console.log(`No entitlement found for wallet: ${walletAddress}`);
      return new Response(
        JSON.stringify({ 
          dataset: null,
          entitlement: null,
          now: new Date().toISOString(),
          valid_until: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    const validUntil = new Date(entitlement.valid_until);
    const isValid = now < validUntil;

    console.log(`Found entitlement for ${walletAddress}: valid=${isValid}, expires=${validUntil.toISOString()}`);

    // Return entitlement and dataset info
    const response = {
      dataset: entitlement.shared_dataset ? {
        items: entitlement.shared_dataset.items,
        next_available_at: entitlement.shared_dataset.expires_at
      } : null,
      entitlement: {
        id: entitlement.id,
        tx_hash: entitlement.tx_hash,
        valid_until: entitlement.valid_until,
        created_at: entitlement.created_at,
        is_valid: isValid,
      },
      now: now.toISOString(),
      valid_until: entitlement.valid_until,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('x402-status error:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
