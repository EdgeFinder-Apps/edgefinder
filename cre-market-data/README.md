# Chainlink CRE Workflows

This directory contains **Chainlink Runtime Environment (CRE)** workflows that fetch prediction market data from Polymarket and Kalshi APIs. These workflows are designed to replace traditional web2 serverless functions with a trust-minimized, onchain alternative.

## What are CRE Workflows?

CRE workflows are decentralized, tamper-proof data pipelines that run on Chainlink's Decentralized Oracle Network (DON). Unlike traditional serverless functions:

- **Consensus-driven**: Multiple nodes fetch and verify data independently
- **Cryptographically secure**: Results are aggregated and signed by the DON
- **Verifiable onchain**: Can write results directly to smart contracts with proof of origin

## Current Workflows

### 1. Polymarket Open Markets (`polymarket-open-markets/`)
Fetches all open politics-related markets from Polymarket's Gamma API.

**What it does:**
- Paginates through Polymarket markets
- Filters for active politics markets using regex matching
- Returns market data (slug, prices, volume, etc.)
- Writes a record of the update onchain to Arbitrum Sepolia

### 2. Kalshi Open Markets (`kalshi-open-markets/`)
Fetches all open politics-related markets from Kalshi's Elections API.

**What it does:**
- Loads politics series from Kalshi
- Fetches markets for each series
- Returns market data (tickers, prices, spreads, etc.)
- Writes a record of the update onchain to Arbitrum Sepolia

## Architecture

```
workflows/
├── shared/
│   ├── heartbeat.ts    # Writes execution logs onchain
│   └── http.ts         # CRE-compatible HTTP client
├── polymarket-open-markets/
│   ├── main.ts         # Workflow entry point
│   ├── config.*.json   # Environment configs
│   └── workflow.yaml   # CRE workflow manifest
└── kalshi-open-markets/
    ├── main.ts
    ├── config.*.json
    └── workflow.yaml
```

## How to Use

### Prerequisites
- [CRE CLI](https://docs.chain.link/cre) installed and authenticated
- [Bun](https://bun.sh)

### Install Dependencies

```bash
# Install for polymarket workflow
cd workflows/polymarket-open-markets
bun install

# Install for kalshi workflow
cd ../kalshi-open-markets
bun install
```

### Simulate Locally

Run workflows in simulation mode to test without deploying:

```bash
# From cre-market-data/ directory
cre workflow simulate workflows/polymarket-open-markets --target staging-settings
cre workflow simulate workflows/kalshi-open-markets --target staging-settings
```

### Configuration

Each workflow has two config files:
- `config.staging.json` - Used for local simulation and testing
- `config.production.json` - Used for production deployments

**Key settings:**
```json
{
  "schedule": "0 */15 * * * *",  // Cron schedule (every 15 min)
  "maxMarkets": 50,               // Max markets to fetch
  "pageSize": 100,                // API page size
  "heartbeat": {
    "enabled": true,              // Write execution log onchain
    "chainSelectorName": "ethereum-testnet-sepolia-arbitrum-1",
    "contractAddress": "0x...",   // Consumer contract address
    "gasLimit": "200000"
  }
}
```

### Deploy to Production

```bash
# Deploy polymarket workflow
cre workflow deploy workflows/polymarket-open-markets --target production-settings

# Deploy kalshi workflow
cre workflow deploy workflows/kalshi-open-markets --target production-settings
```

## Current Status

**Simulation Mode** - Both workflows are fully functional in local simulation and ready for production deployment.

### Next Steps

These workflows are designed to replace the **Supabase Edge Functions** currently used in the main application. Once deployed to production:

1. Remove dependency on centralized cloud providers
2. Enable **verifiable, tamper-proof** market data fetching
3. Write market data directly to blockchain storage or emit events
4. Provide cryptographic proof that data came from Chainlink DON

