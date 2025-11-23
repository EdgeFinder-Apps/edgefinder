import { cre, Runner, type Runtime, type NodeRuntime, consensusIdenticalAggregation } from "@chainlink/cre-sdk";
import { z } from "zod";
import { makeHttpRequest } from "../shared/http";
import { sendHeartbeat, type HeartbeatConfig } from "../shared/heartbeat";

const SERIES_BASE = "https://api.elections.kalshi.com/trade-api/v2/series?limit=1000";
const MARKETS_BASE = "https://api.elections.kalshi.com/trade-api/v2/markets";

const configSchema = z.object({
  schedule: z.string(),
  maxMarkets: z.number().default(10000),
  seriesPageLimit: z.number().default(10),
  seriesOffset: z.number().default(0),
  seriesLimit: z.number().default(300),
  heartbeat: z
    .object({
      enabled: z.boolean().default(false),
      chainSelectorName: z.string(),
      contractAddress: z.string(),
      gasLimit: z.union([z.string(), z.number()]).default("150000"),
    })
    .optional(),
});

type Config = z.infer<typeof configSchema>;

type Market = Record<string, any>;

function loadPoliticsSeries(nodeRuntime: NodeRuntime<Config>): string[] {
  const tickers = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < nodeRuntime.config.seriesPageLimit; page++) {
    try {
      const url = cursor ? `${SERIES_BASE}&cursor=${cursor}` : SERIES_BASE;
      const res = makeHttpRequest(nodeRuntime, url, { Accept: "application/json" });
      
      if (!res.ok) {
        nodeRuntime.log(`Failed to fetch series page ${page}: status ${res.statusCode}`);
        break;
      }

      const bodyText = res.text();
      if (!bodyText || bodyText.length === 0) {
        nodeRuntime.log(`Empty response for series page ${page}`);
        break;
      }

      const data = JSON.parse(bodyText);
      const series = data?.series || [];
      series
        .filter((s: any) => s?.category === "Politics")
        .forEach((s: any) => tickers.add(s.ticker));

      cursor = data?.cursor || null;
      if (!cursor) break;
    } catch (err) {
      nodeRuntime.log(`Error loading series page ${page}: ${String(err)}`);
      break;
    }
  }

  nodeRuntime.log(`Loaded ${tickers.size} politics series`);
  return Array.from(tickers);
}

function fetchSeriesMarkets(nodeRuntime: NodeRuntime<Config>, seriesTickers: string[]): Market[] {
  const markets: Market[] = [];
  let pagesFetched = 0;

  const slice = seriesTickers.slice(nodeRuntime.config.seriesOffset, nodeRuntime.config.seriesOffset + nodeRuntime.config.seriesLimit);
  for (const ticker of slice) {
    if (markets.length >= nodeRuntime.config.maxMarkets) {
      nodeRuntime.log(`Reached maxMarkets limit of ${nodeRuntime.config.maxMarkets}`);
      break;
    }

    try {
      const queryString = `series_ticker=${encodeURIComponent(ticker)}&status=open&limit=100`;
      const url = `${MARKETS_BASE}?${queryString}`;

      const res = makeHttpRequest(nodeRuntime, url, { Accept: "application/json" });

      if (!res.ok) {
        nodeRuntime.log(`Failed to fetch markets for ${ticker}: status ${res.statusCode}`);
        continue;
      }

      const bodyText = res.text();
      if (!bodyText || bodyText.length === 0) {
        nodeRuntime.log(`Empty response for markets ${ticker}`);
        continue;
      }

      const data = JSON.parse(bodyText);
      const seriesMarkets: Market[] = data?.markets || [];
      if (seriesMarkets.length > 0) {
        markets.push(...seriesMarkets);
        pagesFetched++;
      }
    } catch (err) {
      nodeRuntime.log(`Error fetching markets for ${ticker}: ${String(err)}`);
      continue;
    }
  }

  nodeRuntime.log(`Fetched ${markets.length} Kalshi markets from ${pagesFetched} series`);
  return markets;
}

function mapKalshiRows(markets: Market[]) {
  return markets.map((m: any) => ({
    ticker: m?.ticker ?? null,
    event_ticker: m?.event_ticker ?? null,
    title: m?.title ?? null,
    subtitle: m?.subtitle ?? null,
    market_type: m?.market_type ?? null,
    status: m?.status ?? null,
    open_time: m?.open_time ?? null,
    close_time: m?.close_time ?? null,
    expiration_time: m?.expiration_time ?? null,
    yes_bid: typeof m?.yes_bid === "number" ? m.yes_bid : m?.yes_bid ? Number(m.yes_bid) : null,
    yes_ask: typeof m?.yes_ask === "number" ? m.yes_ask : m?.yes_ask ? Number(m.yes_ask) : null,
    no_bid: typeof m?.no_bid === "number" ? m.no_bid : m?.no_bid ? Number(m.no_bid) : null,
    no_ask: typeof m?.no_ask === "number" ? m.no_ask : m?.no_ask ? Number(m.no_ask) : null,
    last_price:
      typeof m?.last_price === "number"
        ? m.last_price
        : m?.last_price
        ? Number(m.last_price)
        : null,
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
}

type FetchResult = {
  seriesTickers: string[];
  markets: Market[];
};

function fetchKalshiData(nodeRuntime: NodeRuntime<Config>): FetchResult {
  const seriesTickers = loadPoliticsSeries(nodeRuntime);
  const markets = fetchSeriesMarkets(nodeRuntime, seriesTickers);
  return { seriesTickers, markets };
}

function handler(runtime: Runtime<Config>): string {
  const result = runtime.runInNodeMode(
    fetchKalshiData,
    consensusIdenticalAggregation<FetchResult>()
  )().result();

  const { seriesTickers, markets } = result;
  const upserted = 0; // not persisting yet as still in simulation mode
  const timestamp = Math.floor(Date.now() / 1000);

  try {
    sendHeartbeat(runtime as Runtime<Config & { heartbeat?: HeartbeatConfig }>, {
      workflow: "kalshi-open-markets",
      count: markets.length,
      upserted,
      timestamp,
    });
  } catch (err) {
    runtime.log(`Heartbeat failed (non-fatal): ${String(err)}`);
  }

  const summary = {
    total_series: seriesTickers.length,
    markets: markets.length,
    upserted,
    persisted: false,
    window: {
      offset: runtime.config.seriesOffset,
      limit: runtime.config.seriesLimit,
    },
  };

  runtime.log(JSON.stringify(summary));
  return JSON.stringify(summary);
}

const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();
  return [cre.handler(cron.trigger({ schedule: config.schedule }), handler)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
