import { cre, Runner, type Runtime, type NodeRuntime, consensusIdenticalAggregation } from "@chainlink/cre-sdk";
import { z } from "zod";
import { makeHttpRequest } from "../shared/http";
import { sendHeartbeat, type HeartbeatConfig } from "../shared/heartbeat";

const POLITICS_REGEX =
  /election|president|senate|congress|governor|vote|political|campaign|trump|harris|democrat|republican|gop|ballot|cabinet|nomination/i;
const GAMMA_BASE = "https://gamma-api.polymarket.com/markets";

const configSchema = z.object({
  schedule: z.string(),
  maxMarkets: z.number().default(20000),
  pageSize: z.number().default(200),
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

function fetchPolymarketMarkets(nodeRuntime: NodeRuntime<Config>): Market[] {
  const { maxMarkets, pageSize } = nodeRuntime.config;
  const markets: Market[] = [];
  let pagesFetched = 0;
  let offset = 0;

  for (;; pagesFetched++, offset += pageSize) {
    if (markets.length >= maxMarkets) {
      nodeRuntime.log(`Reached maxMarkets limit of ${maxMarkets}`);
      break;
    }

    const queryString = `closed=false&limit=${pageSize}&offset=${offset}`;
    const url = `${GAMMA_BASE}?${queryString}`;

    const res = makeHttpRequest(nodeRuntime, url, { Accept: "application/json" });

    if (!res.ok) {
      const body = res.text().slice(0, 400);
      throw new Error(`Gamma upstream error ${res.statusCode}: ${body}`);
    }

    const page = res.json() as unknown;
    if (!Array.isArray(page)) {
      throw new Error(`Unexpected Gamma response shape at offset ${offset}`);
    }
    if (page.length === 0) break;

    const politicsMarkets = page.filter((m: any) => {
      const question = m?.question || "";
      const description = m?.description || "";
      const category = m?.category || "";
      const isActive = m?.active !== false;
      const isOpen = m?.closed !== true;

      return (
        isActive &&
        isOpen &&
        (POLITICS_REGEX.test(question) ||
          POLITICS_REGEX.test(description) ||
          category.toLowerCase().includes("politic"))
      );
    });

    markets.push(...politicsMarkets);
  }

  nodeRuntime.log(`Fetched ${markets.length} politics markets from Polymarket`);
  return markets;
}

function mapPolymarketRows(markets: Market[]) {
  return markets.map((m: any) => ({
    slug: m?.slug ?? null,
    question: m?.question ?? null,
    category: m?.category ?? null,
    start_date: m?.startDate ?? null,
    end_date: m?.endDate ?? null,
    closed: m?.closed ?? null,
    last_trade_price:
      typeof m?.lastTradePrice === "number"
        ? m.lastTradePrice
        : m?.lastTradePrice
        ? Number(m.lastTradePrice)
        : null,
    volume: typeof m?.volume === "number" ? m.volume : m?.volume ? Number(m.volume) : null,
    active: m?.active ?? null,
    outcome_prices:
      m?.outcomePrices
        ? typeof m.outcomePrices === "string"
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices
        : null,
    group_item_title: m?.groupItemTitle ?? null,
    condition_id: m?.conditionId ?? null,
    event_slug: m?.events?.[0]?.slug ?? null,
    raw_json: m,
  }));
}

function handler(runtime: Runtime<Config>): string {
  const markets = runtime.runInNodeMode(
    fetchPolymarketMarkets,
    consensusIdenticalAggregation<Market[]>()
  )().result();

  const upserted = 0; // not persisting yet as still in simulation mode
  const timestamp = Math.floor(Date.now() / 1000);
  
  try {
    sendHeartbeat(runtime as Runtime<Config & { heartbeat?: HeartbeatConfig }>, {
      workflow: "polymarket-open-markets",
      count: markets.length,
      upserted,
      timestamp,
    });
  } catch (err) {
    runtime.log(`Heartbeat failed (non-fatal): ${String(err)}`);
  }

  const summary = {
    markets: markets.length,
    upserted,
    persisted: false,
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
