/**
 * Supabase Edge Function: Polymarket Embedding Generation
 * Generates embeddings for Polymarket markets to enable semantic search
 * and cross-platform event matching (e.g., find similar events on Kalshi).
 *
 * Constructs semantic text from question, category, and end_date.
 */

import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const openaiKey = Deno.env.get("OPENAI_API_KEY");

const supabase = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

// create semantic text for embedding
function buildSemanticText(market: any): string {
  const parts: string[] = [];
  
  // the main question is the primary semantic signal
  if (market.question) parts.push(market.question);
  
  // the description provides additional context
  if (market.raw_json?.description) {
    // take first 300 chars of description for context
    const desc = market.raw_json.description.substring(0, 300).trim();
    parts.push(desc);
  }
  
  // event title for additional context
  if (market.raw_json?.events?.[0]?.title) {
    parts.push(`Event: ${market.raw_json.events[0].title}`);
  }
  
  // end date for relevance (helps with time-sensitive matching)
  if (market.end_date) {
    const date = new Date(market.end_date);
    parts.push(`Resolves: ${date.toISOString().split('T')[0]}`);
  }
  
  return parts.join(". ");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Validate dependencies
    if (!supabase) {
      return new Response(
        JSON.stringify({ error: "Supabase client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (!openai) {
      return new Response(
        JSON.stringify({ error: "OpenAI client not configured. Set OPENAI_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse batch size from query params
    const url = new URL(req.url);
    const batchSize = Math.min(100, Math.max(1, Number(url.searchParams.get("batch_size")) || 50));

    // Fetch markets without embeddings (include raw_json for description)
    const { data: markets, error: fetchError } = await supabase
      .from("polymarket_markets")
      .select("id, slug, question, end_date, raw_json")
      .is("embedding", null)
      .limit(batchSize);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch markets: ${fetchError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!markets || markets.length === 0) {
      return new Response(
        JSON.stringify({ message: "No markets without embeddings found", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate embeddings
    let processed = 0;
    let errors = 0;

    for (const market of markets) {
      try {
        const text = buildSemanticText(market);
        
        if (!text || text.trim().length === 0) {
          console.warn(`Skipping market ${market.slug}: no semantic text`);
          errors++;
          continue;
        }

        // Generate embedding
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: text,
        });

        if (!response?.data?.[0]?.embedding) {
          console.error(`Failed to generate embedding for ${market.slug}`);
          errors++;
          continue;
        }

        const embedding = response.data[0].embedding;

        // Update the row
        const { error: updateError } = await supabase
          .from("polymarket_markets")
          .update({ embedding })
          .eq("id", market.id);

        if (updateError) {
          console.error(`Failed to update ${market.slug}:`, updateError.message);
          errors++;
        } else {
          processed++;
        }

        await new Promise(r => setTimeout(r, 100));
      } catch (err: any) {
        console.error(`Error processing market ${market.slug}:`, err.message);
        errors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Embedding generation complete",
        processed,
        errors,
        total: markets.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error.message);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
