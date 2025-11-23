create table if not exists public.evvm_sandbox_actions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id text not null,
  action_hash text not null,
  async_nonce bigint not null,
  executor_address text not null,
  sepolia_tx_hash text not null,
  evvm_intent_id bigint not null,
  user_address text,
  metadata jsonb,
  created_at timestamp with time zone default now() not null
);

create index if not exists evvm_sandbox_actions_created_at_idx 
  on public.evvm_sandbox_actions (created_at desc);

create index if not exists evvm_sandbox_actions_user_address_idx 
  on public.evvm_sandbox_actions (user_address);

create index if not exists evvm_sandbox_actions_opportunity_id_idx 
  on public.evvm_sandbox_actions (opportunity_id);

alter table public.evvm_sandbox_actions enable row level security;

create policy "Allow anonymous read access to evvm_sandbox_actions"
  on public.evvm_sandbox_actions
  for select
  to anon
  using (true);

create policy "Allow authenticated read access to evvm_sandbox_actions"
  on public.evvm_sandbox_actions
  for select
  to authenticated
  using (true);
