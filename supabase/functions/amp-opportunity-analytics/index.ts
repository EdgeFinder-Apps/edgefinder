import { corsHeaders } from "../_shared/cors.ts";
import { getEdgeAnalytics } from "../_shared/amp.ts";

interface AnalyticsRequest {
  opportunity_id: string;
  time_window_hours?: number;
  edge_threshold?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // return mock data for hackathon demo
    const DEMO_MODE = Deno.env.get("AMP_DEMO_MODE") === "true";
    
    let opportunityId: string;
    let timeWindowHours = 24;
    let edgeThreshold = 5.0;

    if (req.method === "GET") {
      const url = new URL(req.url);
      const id = url.searchParams.get("opportunity_id");
      if (!id) {
        return new Response(
          JSON.stringify({ error: "opportunity_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      opportunityId = id;
      timeWindowHours = parseInt(url.searchParams.get("time_window_hours") || "24");
      edgeThreshold = parseFloat(url.searchParams.get("edge_threshold") || "5.0");
    } else {
      const body: AnalyticsRequest = await req.json();
      if (!body.opportunity_id) {
        return new Response(
          JSON.stringify({ error: "opportunity_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      opportunityId = body.opportunity_id;
      timeWindowHours = body.time_window_hours || 24;
      edgeThreshold = body.edge_threshold || 5.0;
    }

    // return mock analytics data until developer preview is enabled
    if (DEMO_MODE) {
      const mockAnalytics = {
        edge_min: 3.5 + Math.random() * 2,
        edge_max: 8.2 + Math.random() * 3,
        edge_avg: 5.8 + Math.random() * 2,
        snapshot_count: Math.floor(15 + Math.random() * 30),
        first_seen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        last_seen: new Date().toISOString(),
        duration_minutes: 120 + Math.random() * 180,
        samples_above_threshold: Math.floor(8 + Math.random() * 15),
        amp_edge_score: 3.5 + Math.random() * 2.5,
      };

      const isPersistent = mockAnalytics.duration_minutes >= 30 && mockAnalytics.samples_above_threshold >= 3;
      const isStable = mockAnalytics.edge_max - mockAnalytics.edge_min < 3.0;

      let edgeQuality = 'NOISY';
      if (isPersistent && isStable) {
        edgeQuality = 'STABLE';
      } else if (isPersistent) {
        edgeQuality = 'PERSISTENT';
      } else if (isStable) {
        edgeQuality = 'STABLE_SHORT';
      }

      return new Response(
        JSON.stringify({
          opportunity_id: opportunityId,
          has_data: true,
          analytics: {
            ...mockAnalytics,
            edge_quality: edgeQuality,
            is_persistent: isPersistent,
            is_stable: isStable,
          },
          metadata: {
            time_window_hours: timeWindowHours,
            edge_threshold: edgeThreshold,
            powered_by: "Amp from The Graph (Demo Mode)",
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const analytics = await getEdgeAnalytics(opportunityId, timeWindowHours, edgeThreshold);

    if (!analytics) {
      return new Response(
        JSON.stringify({
          opportunity_id: opportunityId,
          has_data: false,
          message: "No edge history found for this opportunity in the time window",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const edgePersistenceMinutes = analytics.duration_minutes;
    const isPersistent = edgePersistenceMinutes >= 30 && analytics.samples_above_threshold >= 3;
    const isStable = analytics.edge_max - analytics.edge_min < 3.0;

    let edgeQuality = 'NOISY';
    if (isPersistent && isStable) {
      edgeQuality = 'STABLE';
    } else if (isPersistent) {
      edgeQuality = 'PERSISTENT';
    } else if (isStable) {
      edgeQuality = 'STABLE_SHORT';
    }

    const response = {
      opportunity_id: opportunityId,
      has_data: true,
      analytics: {
        edge_min: analytics.edge_min,
        edge_max: analytics.edge_max,
        edge_avg: analytics.edge_avg,
        snapshot_count: analytics.snapshot_count,
        first_seen: analytics.first_seen,
        last_seen: analytics.last_seen,
        duration_minutes: edgePersistenceMinutes,
        samples_above_threshold: analytics.samples_above_threshold,
        amp_edge_score: analytics.amp_edge_score,
        edge_quality: edgeQuality,
        is_persistent: isPersistent,
        is_stable: isStable,
      },
      metadata: {
        time_window_hours: timeWindowHours,
        edge_threshold: edgeThreshold,
        powered_by: "Amp from The Graph",
      },
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Analytics error:", error);
    
    if (error.message.includes("AMP_PROJECT_ID") || error.message.includes("AMP_API_KEY")) {
      return new Response(
        JSON.stringify({
          error: "Amp configuration incomplete",
          message: "AMP_PROJECT_ID and AMP_API_KEY environment variables must be set",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Failed to fetch analytics",
        message: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
