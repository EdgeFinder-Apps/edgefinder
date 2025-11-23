/**
 * Supabase Edge Function: Polymarket Open Markets
 * Fetches all open markets from Polymarket Gamma API with pagination.
 *
 * Docs:
 * - Gamma API overview: https://docs.polymarket.com/developers/gamma-markets-api/overview
 * - Get Markets: https://docs.polymarket.com/developers/gamma-markets-api/get-markets
 *   Pagination: limit + offset; filter open with closed=false.
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Market = Record<string, unknown>;

const GAMMA_BASE = "https://gamma-api.polymarket.com/markets";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("VITE_SUPABASE_SERVICE_ROLE_KEY");
const supabase =
  supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

// retry with backoff
async function fetchWithRetry(url: string, init: RequestInit, retries = 2) {
  let attempt = 0;
  const baseDelay = 300;
  for (;;) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal });
      if (res.status >= 200 && res.status < 300) return res;
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
      clearTimeout(t);
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
    const persist = url.searchParams.get("persist") === "true";

    // get biggest page size possible
    const pageSize = Math.max(1, Math.min(1000, Number(limitParam) || 100));
    const maxMarkets = Number(maxMarketsParam) || 20000;

    const markets: Market[] = [];
    let pagesFetched = 0;
    let offset = 0;

    // Continue fetching until empty page or max markets reached
    for (;;pagesFetched++, offset += pageSize) {
      if (markets.length >= maxMarkets) {
        console.log(`Reached max_markets limit of ${maxMarkets}`);
        break;
      }
      const qs = new URLSearchParams({
        closed: "false",
        limit: String(pageSize),
        offset: String(offset),
      });
      const endpoint = `${GAMMA_BASE}?${qs.toString()}`;

      const res = await fetchWithRetry(endpoint, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return new Response(
          JSON.stringify({
            error: "Upstream error from Polymarket Gamma",
            status: res.status,
            body: text.slice(0, 800),
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const page: unknown = await res.json();
      if (!Array.isArray(page)) {
        return new Response(
          JSON.stringify({ error: "Unexpected Gamma response shape", got: page }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (page.length === 0) break;
      
      // Filter for politics markets that are active and not settled
      const politicsKeywords = /election|president|senate|congress|governor|vote|political|campaign|trump|harris|democrat|republican|gop|ballot|cabinet|nomination/i;
      const politicsMarkets = page.filter((m: any) => {
        const question = m.question || "";
        const description = m.description || "";
        const category = m.category || "";
        const isActive = m.active !== false;
        const isOpen = m.closed !== true;
        
        return isActive && isOpen && (
          politicsKeywords.test(question) || 
          politicsKeywords.test(description) || 
          category.toLowerCase().includes("politic")
        );
      });
      
      markets.push(...politicsMarkets);
    }

    let upserted = 0;
    if (persist) {
      if (!supabase) {
        return new Response(
          JSON.stringify({
            error:
              "Supabase service key or URL missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Map to table columns
      const rows = markets.map((m: any) => ({
        slug: m?.slug ?? null,
        question: m?.question ?? null,
        category: m?.category ?? null,
        start_date: m?.startDate ? new Date(m.startDate) : null,
        end_date: m?.endDate ? new Date(m.endDate) : null,
        closed: m?.closed ?? null,
        last_trade_price:
          typeof m?.lastTradePrice === "number"
            ? m.lastTradePrice
            : m?.lastTradePrice
            ? Number(m.lastTradePrice)
            : null,
        volume:
          typeof m?.volume === "number" ? m.volume : m?.volume ? Number(m.volume) : null,
        active: m?.active ?? null,
        outcome_prices: 
          m?.outcomePrices 
            ? (typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices)
            : null,
        group_item_title: m?.groupItemTitle ?? null,
        condition_id: m?.conditionId ?? null,
        event_slug: m?.events?.[0]?.slug ?? null,
        raw_json: m,
      }));

      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error, count } = await supabase
          .from("polymarket_markets")
          .upsert(chunk, { onConflict: "slug", ignoreDuplicates: false, count: "exact" });
        if (error) {
          return new Response(JSON.stringify({ error: error.message, atBatch: i }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        upserted += count ?? chunk.length;
      }
    }

    const payload = {
      meta: {
        pages_fetched: pagesFetched,
        page_size: pageSize,
        upserted: persist ? upserted : 0,
        persisted: persist,
      },
      markets,
    };

    return new Response(JSON.stringify(payload), {
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
