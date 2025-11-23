-- Create tables for x402 payment system integration

-- Table to store user datasets (snapshots of arbitrage opportunities)
create table if not exists public.user_datasets (
  id uuid not null default gen_random_uuid(),
  wallet_address text not null,
  items jsonb not null, -- Array of arbitrage opportunities
  created_at timestamp with time zone not null default now(),
  next_available_at timestamp with time zone not null default (now() + interval '1 hour'),
  constraint user_datasets_pkey primary key (id),
  constraint user_datasets_wallet_address_check check (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Table to store payment entitlements
create table if not exists public.entitlements (
  id uuid not null default gen_random_uuid(),
  wallet_address text not null,
  dataset_id uuid not null references public.user_datasets(id) on delete cascade,
  tx_hash text not null,
  facilitator_response jsonb, -- Store full facilitator response
  valid_until timestamp with time zone not null default (now() + interval '1 hour'),
  created_at timestamp with time zone not null default now(),
  constraint entitlements_pkey primary key (id),
  constraint entitlements_wallet_address_check check (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
  constraint entitlements_tx_hash_check check (tx_hash ~ '^(0x[a-fA-F0-9]{64}|dev-bypass)$')
);

-- Indexes
create index if not exists user_datasets_wallet_address_idx on public.user_datasets(wallet_address);
create index if not exists user_datasets_next_available_at_idx on public.user_datasets(next_available_at);
create index if not exists entitlements_wallet_address_idx on public.entitlements(wallet_address);
create index if not exists entitlements_dataset_id_idx on public.entitlements(dataset_id);
create index if not exists entitlements_valid_until_idx on public.entitlements(valid_until);

-- Comments
comment on table public.user_datasets is 'Stores snapshots of arbitrage opportunities for users who have paid';
comment on table public.entitlements is 'Tracks user payment entitlements and their validity periods';
comment on column public.user_datasets.items is 'JSON array of arbitrage opportunities at time of payment';
comment on column public.user_datasets.next_available_at is 'When the user can next purchase a dataset';
comment on column public.entitlements.facilitator_response is 'Full response from x402 facilitator for auditing';
comment on column public.entitlements.valid_until is 'When this entitlement expires';
