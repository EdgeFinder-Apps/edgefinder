/**
 * Supabase Edge Function: Kalshi Open Markets
 * Fetches all open markets from Kalshi with cursor pagination.
 *
 * Docs:
 * - Get Markets: https://docs.kalshi.com/api-reference/market/get-markets
 * - First request guidance: https://docs.kalshi.com/getting_started/making_your_first_request
 * - Pagination: https://docs.kalshi.com/getting_started/pagination
 * - Rate limits: https://docs.kalshi.com/getting_started/rate_limits
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Market = Record<string, unknown>;

const BASE = "https://api.elections.kalshi.com/trade-api/v2/markets";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
const supabase =
  supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

async function fetchWithRetry(url: string, init: RequestInit, retries = 2) {
  let attempt = 0;
  const baseDelay = 300;
  for (;;) {
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10_000);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal });
      if (res.ok) return res;
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        attempt++;
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        attempt++;
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 100);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const maxMarketsParam = url.searchParams.get("max_markets");
    const seriesOffsetParam = url.searchParams.get("series_offset");
    const seriesLimitParam = url.searchParams.get("series_limit");
    const persist = url.searchParams.get("persist") === "true";

    const pageSize = Math.max(1, Math.min(1000, Number(limitParam) || 100));
    const maxMarkets = Number(maxMarketsParam) || 10000;
    const seriesOffset = Number(seriesOffsetParam) || 0;
    const seriesLimit = Number(seriesLimitParam) || 300; // Fetch 300 series per call

    const markets: Market[] = [];
    let pagesFetched = 0;
    let cursor: string | null = null;

    // get Politics series tickers list (from series API response)
    let politicsSeriesTickers = new Set<string>();
    
    // Fetch ALL series (with pagination) to get complete Politics tickers list
    try {
      let seriesCursor: string | null = null;
      let seriesPages = 0;
      do {
        const seriesUrl = seriesCursor 
          ? `https://api.elections.kalshi.com/trade-api/v2/series?limit=1000&cursor=${seriesCursor}`
          : `https://api.elections.kalshi.com/trade-api/v2/series?limit=1000`;
        
        const seriesRes = await fetchWithRetry(seriesUrl, { headers: { Accept: "application/json" } });
        if (!seriesRes.ok) break;
        
        const seriesData = await seriesRes.json();
        const series = seriesData?.series || [];
        
        // Add Politics series to set
        series.filter((s: any) => s.category === "Politics").forEach((s: any) => {
          politicsSeriesTickers!.add(s.ticker);
        });
        
        seriesCursor = seriesData.cursor || null;
        seriesPages++;
      } while (seriesCursor && seriesPages < 10); // Safety limit
      
      console.log(`Loaded ${politicsSeriesTickers.size} Politics series tickers from ${seriesPages} pages`);
    } catch (e) {
      console.error("Failed to fetch series list:", e);
    }

    // Fetch markets for each Politics series
    const politicsSeriesArray = Array.from(politicsSeriesTickers);
    console.log(`Total Politics series available: ${politicsSeriesArray.length}`);
    
    // Paginate
    const seriesSlice = politicsSeriesArray.slice(seriesOffset, seriesOffset + seriesLimit);
    const hasMore = seriesOffset + seriesLimit < politicsSeriesArray.length;
    const nextOffset = hasMore ? seriesOffset + seriesLimit : null;
    
    console.log(`Fetching series ${seriesOffset}-${seriesOffset + seriesSlice.length} (${seriesSlice.length} series, hasMore: ${hasMore})`);
    
    for (const seriesTicker of seriesSlice) {
      if (markets.length >= maxMarkets) {
        console.log(`Reached max_markets limit of ${maxMarkets}`);
        break;
      }
      
      const qs = new URLSearchParams({
        series_ticker: seriesTicker,
        status: "open",
        limit: "100",
      });
      
      const endpoint = `${BASE}?${qs.toString()}`;
      const res = await fetchWithRetry(endpoint, { headers: { Accept: "application/json" } });
      
      if (!res.ok) continue;
      
      const data = await res.json();
      const seriesMarkets: Market[] = data?.markets || [];
      
      if (seriesMarkets.length > 0) {
        markets.push(...seriesMarkets);
        pagesFetched++;
        console.log(`Series ${seriesTicker}: ${seriesMarkets.length} markets (total: ${markets.length})`);
      }
      
      if (pagesFetched % 50 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Fetched ${markets.length} Politics markets from ${pagesFetched} series`);

    let upserted = 0;
    if (persist) {
      if (!supabase) {
        return new Response(
          JSON.stringify({
            error: "Supabase URL or service role key missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Map Kalshi markets to schema
      const rows = markets.map((m: any) => ({
        ticker: m?.ticker ?? null,
        event_ticker: m?.event_ticker ?? null,
        title: m?.title ?? null,
        subtitle: m?.subtitle ?? null,
        market_type: m?.market_type ?? null,
        status: m?.status ?? null,
        open_time: m?.open_time ? new Date(m.open_time) : null,
        close_time: m?.close_time ? new Date(m.close_time) : null,
        expiration_time: m?.expiration_time ? new Date(m.expiration_time) : null,
        yes_bid: typeof m?.yes_bid === "number" ? m.yes_bid : m?.yes_bid ? Number(m.yes_bid) : null,
        yes_ask: typeof m?.yes_ask === "number" ? m.yes_ask : m?.yes_ask ? Number(m.yes_ask) : null,
        no_bid: typeof m?.no_bid === "number" ? m.no_bid : m?.no_bid ? Number(m.no_bid) : null,
        no_ask: typeof m?.no_ask === "number" ? m.no_ask : m?.no_ask ? Number(m.no_ask) : null,
        last_price:
          typeof m?.last_price === "number" ? m.last_price : m?.last_price ? Number(m.last_price) : null,
        volume: typeof m?.volume === "number" ? m.volume : m?.volume ? Number(m.volume) : null,
        open_interest:
          typeof m?.open_interest === "number"
            ? m.open_interest
            : m?.open_interest
            ? Number(m.open_interest)
            : null,
        category: m?.category ?? null,
        raw_json: m,
      }));

      // Upsert in chunks
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error, count } = await supabase
          .from("kalshi_markets")
          .upsert(chunk, { onConflict: "ticker", ignoreDuplicates: false, count: "exact" });
        if (error) {
          return new Response(JSON.stringify({ error: error.message, atBatch: i }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        upserted += count ?? chunk.length;
      }
    }

    const response = {
      meta: {
        total_markets: markets.length,
        series_fetched: pagesFetched,
        upserted: persist ? upserted : 0,
        persisted: persist,
        pagination: {
          total_series_available: politicsSeriesArray.length,
          series_offset: seriesOffset,
          series_fetched: seriesSlice.length,
          has_more: hasMore,
          next_offset: nextOffset,
        },
      },
      sample_markets: markets.slice(0, 5),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60, s-maxage=3600",
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
