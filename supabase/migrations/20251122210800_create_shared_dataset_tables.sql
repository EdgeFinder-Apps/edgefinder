-- Enable a single scheduled pipeline to serve all users

-- Track pipeline runs (scheduled hourly)
create table if not exists public.pipeline_runs (
  id uuid not null default gen_random_uuid(),
  started_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  status text not null default 'running', -- 'running', 'completed', 'failed'
  market_matches_count int,
  error_message text,
  constraint pipeline_runs_pkey primary key (id),
  constraint pipeline_runs_status_check check (status in ('running', 'completed', 'failed'))
);

-- Index for finding latest completed run
create index if not exists pipeline_runs_completed_at_idx 
  on public.pipeline_runs(completed_at desc) 
  where status = 'completed';

-- Shared datasets
create table if not exists public.shared_datasets (
  id uuid not null default gen_random_uuid(),
  pipeline_run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  items jsonb not null,
  created_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null,
  constraint shared_datasets_pkey primary key (id),
  constraint shared_datasets_pipeline_run_unique unique (pipeline_run_id)
);

-- Index for finding active dataset
create index if not exists shared_datasets_expires_at_idx 
  on public.shared_datasets(expires_at desc);

-- Update entitlements to reference shared datasets instead of user datasets
alter table public.entitlements 
  drop constraint if exists entitlements_dataset_id_fkey;

alter table public.entitlements 
  add column shared_dataset_id uuid references public.shared_datasets(id);

-- Function to get the latest active shared dataset
create or replace function public.get_latest_shared_dataset()
returns table (
  id uuid,
  items jsonb,
  created_at timestamp with time zone,
  expires_at timestamp with time zone
) as $$
begin
  return query
  select 
    sd.id,
    sd.items,
    sd.created_at,
    sd.expires_at
  from public.shared_datasets sd
  where sd.expires_at > now()
  order by sd.created_at desc
  limit 1;
end;
$$ language plpgsql security definer;

-- Function to check if user has valid access
create or replace function public.user_has_access(user_wallet text)
returns boolean as $$
declare
  latest_dataset_id uuid;
  user_entitlement record;
begin
  -- Get latest dataset
  select id into latest_dataset_id
  from public.shared_datasets
  where expires_at > now()
  order by created_at desc
  limit 1;
  
  if latest_dataset_id is null then
    return false;
  end if;
  
  -- Check if user has valid entitlement for this dataset
  select * into user_entitlement
  from public.entitlements
  where wallet_address = user_wallet
    and shared_dataset_id = latest_dataset_id
    and valid_until > now()
  limit 1;
  
  return found;
end;
$$ language plpgsql security definer;

comment on table public.pipeline_runs is 'Tracks scheduled arbitrage pipeline runs';
comment on table public.shared_datasets is 'Shared datasets created by pipeline runs, accessible to all users who pay';
comment on function public.get_latest_shared_dataset is 'Returns the most recent active shared dataset';
comment on function public.user_has_access is 'Checks if a user has paid for access to the current dataset';
