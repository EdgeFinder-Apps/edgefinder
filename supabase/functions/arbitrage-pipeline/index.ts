// Arbitrage Detection Pipeline
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishEdgeSnapshots, type EdgeSnapshot } from "../_shared/amp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PipelineResult {
  success: boolean;
  pipeline_run_id?: string;
  shared_dataset_id?: string;
  steps: {
    fetch_markets?: any;
    generate_embeddings?: any;
    match_markets?: any;
    create_shared_dataset?: any;
    amp_snapshots?: number;
    arbitrage_count?: number;
  };
  errors?: string[];
  duration_ms: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errors: string[] = [];
  const result: PipelineResult = {
    success: true,
    steps: {},
    duration_ms: 0,
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting pipeline...");

    // Create pipeline run record
    const { data: pipelineRun, error: runError } = await supabase
      .from("pipeline_runs")
      .insert({ status: 'running' })
      .select()
      .single();

    if (runError || !pipelineRun) {
      throw new Error(`Failed to create pipeline run: ${runError?.message}`);
    }

    result.pipeline_run_id = pipelineRun.id;
    console.log(`📝 Pipeline run ID: ${pipelineRun.id}`);

    // fetch Markets (call the edge functions)
    console.log("fetching markets...");
    try {
      const [polyRes, kalshiRes] = await Promise.all([
        fetch(`${supabaseUrl}/functions/v1/polymarket-open-markets?persist=true&limit=100`),
        fetch(`${supabaseUrl}/functions/v1/kalshi-open-markets?persist=true&limit=100&series_offset=0&series_limit=300`),
      ]);

      const polyData = await polyRes.json();
      const kalshiData = await kalshiRes.json();

      result.steps.fetch_markets = {
        polymarket: {
          fetched: polyData.meta?.total_markets || 0,
          upserted: polyData.meta?.upserted || 0,
        },
        kalshi: {
          fetched: kalshiData.meta?.total_markets || 0,
          upserted: kalshiData.meta?.upserted || 0,
        },
      };

      console.log(` Polymarket: ${polyData.meta?.upserted || 0} markets`);
      console.log(` Kalshi: ${kalshiData.meta?.upserted || 0} markets`);
    } catch (e: any) {
      errors.push(`Market fetch failed: ${e.message}`);
      console.error("Market fetch error:", e);
    }

    // generate embeddings
    console.log("generating embeddings...");
    try {
      const [polyEmbRes, kalshiEmbRes] = await Promise.all([
        fetch(`${supabaseUrl}/functions/v1/polymarket-embedding-generation`),
        fetch(`${supabaseUrl}/functions/v1/kalshi-embedding-generation`),
      ]);

      const polyEmbData = await polyEmbRes.json();
      const kalshiEmbData = await kalshiEmbRes.json();

      result.steps.generate_embeddings = {
        polymarket: polyEmbData.processed || 0,
        kalshi: kalshiEmbData.processed || 0,
      };

      console.log(` Polymarket: ${polyEmbData.processed || 0} embeddings`);
      console.log(` Kalshi: ${kalshiEmbData.processed || 0} embeddings`);
    } catch (e: any) {
      errors.push(`Embedding generation failed: ${e.message}`);
      console.error("Embedding error:", e);
    }

    // match markets
    console.log("matching markets...");
    try {
      const { data: matchData, error: matchError } = await supabase.rpc("refresh_market_matches");

      if (matchError) throw matchError;

      result.steps.match_markets = matchData;
      console.log(`  Found ${matchData?.best_matches_count || 0} best matches`);
    } catch (e: any) {
      errors.push(`Market matching failed: ${e.message}`);
      console.error("Matching error:", e);
    }

    // create shared dataset
    console.log("creating shared dataset...");
    try {
      // Fetch market matches and transform to frontend format
      const { data: matches, error: matchesError } = await supabase
        .from('market_matches')
        .select(`
          id,
          polymarket_market:polymarket_id(id, slug, question, last_trade_price, volume, group_item_title, event_slug, active, closed),
          kalshi_market:kalshi_id(id, ticker, title, yes_ask, no_bid, last_price, close_time),
          similarity_score,
          created_at
        `)
        .eq('is_best_match', true)
        .order('similarity_score', { ascending: false })
        .limit(100);

      if (matchesError) throw matchesError;

      const activeMatches = (matches || []).filter((match: any) => {
        const polyMarket = match.polymarket_market;
        const kalshiMarket = match.kalshi_market;
        
        // Check if both markets are active
        const polyActive = polyMarket?.active !== false && polyMarket?.closed !== true;
        const kalshiActive = kalshiMarket?.close_time ? new Date(kalshiMarket.close_time) > new Date() : true;
        
        return polyActive && kalshiActive;
      });
      
      const normalizePrice = (value: number) => Math.max(0, Math.min(1, value));

      const items = activeMatches.map((match: any) => {
        const polyMarket = match.polymarket_market;
        const kalshiMarket = match.kalshi_market;
        
        const polyYesPrice = normalizePrice(polyMarket?.last_trade_price ? parseFloat(polyMarket.last_trade_price) : 0.5);
        const kalshiYesPrice = normalizePrice(kalshiMarket?.yes_ask ? parseFloat(kalshiMarket.yes_ask) / 100 : 0.5);
        
        // Construct Polymarket URL
        let polyUrl = '';
        if (polyMarket?.event_slug) {
          polyUrl = `https://polymarket.com/event/${polyMarket.event_slug}`;
        } else if (polyMarket?.slug) {
          polyUrl = `https://polymarket.com/event/${polyMarket.slug}`;
        }
        
        return {
          id: match.id,
          title: polyMarket?.question || kalshiMarket?.title || 'Unknown Event',
          category: 'prediction-market',
          endDateISO: polyMarket?.end_date || kalshiMarket?.close_time || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          polymarket: {
            marketId: polyMarket?.slug || '',
            yesPrice: polyYesPrice,
            noPrice: 1 - polyYesPrice,
            url: polyUrl,
            liquidityUSD: polyMarket?.volume ? parseFloat(polyMarket.volume) : 0
          },
          kalshi: {
            ticker: kalshiMarket?.ticker || '',
            yesPrice: kalshiYesPrice,
            noPrice: 1 - kalshiYesPrice,
            url: kalshiMarket?.ticker 
              ? `https://kalshi.com/markets/${kalshiMarket.ticker.split('-')[0].toLowerCase()}/dm/${kalshiMarket.ticker.toLowerCase()}`
              : '',
            liquidityUSD: 0
          },
          spreadPercent: match.similarity_score * 100,
          hint: 'NONE' as const
        };
      });

      // Create shared dataset
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const { data: sharedDataset, error: datasetError } = await supabase
        .from('shared_datasets')
        .insert({
          pipeline_run_id: pipelineRun.id,
          items: items,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (datasetError) throw datasetError;

      result.shared_dataset_id = sharedDataset.id;
      result.steps.create_shared_dataset = {
        items_count: items.length,
        expires_at: expiresAt.toISOString()
      };
      console.log(`Created shared dataset with ${items.length} items`);

      // Publish edge snapshots to Amp
      console.log("publishing edge snapshots to Amp...");
      const SKIP_AMP = Deno.env.get("AMP_DEMO_MODE") === "true";
      
      if (SKIP_AMP) {
        console.log("Skipping Amp publishing (demo mode enabled)");
        result.steps.amp_snapshots = 0;
      } else {
      try {
        const timestamp = new Date().toISOString();
        const edgeSnapshots: EdgeSnapshot[] = activeMatches
          .map((match: any) => {
            const polyMarket = match.polymarket_market;
            const kalshiMarket = match.kalshi_market;
            
            const polyYesPrice = normalizePrice(polyMarket?.last_trade_price ? parseFloat(polyMarket.last_trade_price) : 0.5);
            const polyNoPrice = 1 - polyYesPrice;
            const kalshiYesPrice = normalizePrice(kalshiMarket?.yes_ask ? parseFloat(kalshiMarket.yes_ask) / 100 : 0.5);
            const kalshiNoPrice = normalizePrice(kalshiMarket?.no_bid ? parseFloat(kalshiMarket.no_bid) / 100 : 0.5);
            
            const option1 = polyYesPrice + kalshiNoPrice;
            const option2 = kalshiYesPrice + polyNoPrice;
            const bestCost = Math.min(option1, option2);
            const edgePercent = bestCost < 1.0 ? (1.0 - bestCost) * 100 : 0;
            const edgeStrategy = option1 < option2 ? 'BUY_YES_PM_BUY_NO_KALSHI' : 'BUY_YES_KALSHI_BUY_NO_PM';
            
            return {
              snapshot_id: crypto.randomUUID(),
              opportunity_id: match.id,
              polymarket_id: polyMarket.id,
              kalshi_id: kalshiMarket.id,
              timestamp,
              polymarket_yes_price: polyYesPrice,
              polymarket_no_price: polyNoPrice,
              kalshi_yes_price: kalshiYesPrice,
              kalshi_no_price: kalshiNoPrice,
              edge_percent: edgePercent,
              edge_strategy: edgeStrategy,
              category: 'politics',
              polymarket_slug: polyMarket?.slug || '',
              kalshi_ticker: kalshiMarket?.ticker || '',
              market_title: polyMarket?.question || kalshiMarket?.title || 'Unknown Event',
            };
          })
          .filter((snapshot: EdgeSnapshot) => snapshot.edge_percent > 0);

        if (edgeSnapshots.length > 0) {
          await publishEdgeSnapshots(edgeSnapshots);
          console.log(`Published ${edgeSnapshots.length} edge snapshots to Amp`);
          result.steps.amp_snapshots = edgeSnapshots.length;
        } else {
          console.log("No edge snapshots to publish (no arbitrage opportunities)");
          result.steps.amp_snapshots = 0;
        }
      } catch (ampError: any) {
        console.error("Amp publishing error:", ampError.message);
        errors.push(`Amp publishing failed: ${ampError.message}`);
      }
      }
    } catch (e: any) {
      errors.push(`Shared dataset creation failed: ${e.message}`);
      console.error("Dataset error:", e);
    }

    result.duration_ms = Date.now() - startTime;

    if (errors.length > 0) {
      result.success = false;
      result.errors = errors;
    }

    // Update pipeline run status
    await supabase
      .from('pipeline_runs')
      .update({
        status: result.success ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
        market_matches_count: result.steps.create_shared_dataset?.items_count || 0,
        error_message: errors.length > 0 ? errors.join('; ') : null
      })
      .eq('id', pipelineRun.id);

    console.log(`Pipeline complete in ${result.duration_ms}ms`);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Pipeline error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
