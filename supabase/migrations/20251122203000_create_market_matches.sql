-- Create table to store market matches between Polymarket and Kalshi
create table if not exists public.market_matches (
  id uuid not null default gen_random_uuid(),
  polymarket_id uuid not null references public.polymarket_markets(id) on delete cascade,
  kalshi_id uuid not null references public.kalshi_markets(id) on delete cascade,
  similarity_score float not null, -- cosine similarity (0-1, higher is better)
  is_best_match boolean not null default false, -- true for 1-to-1 best matches
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint market_matches_pkey primary key (id),
  constraint market_matches_unique_pair unique (polymarket_id, kalshi_id),
  constraint market_matches_similarity_range check (similarity_score >= 0 and similarity_score <= 1)
);

-- Indexes for efficient querying
create index if not exists market_matches_polymarket_id_idx on public.market_matches(polymarket_id);
create index if not exists market_matches_kalshi_id_idx on public.market_matches(kalshi_id);
create index if not exists market_matches_similarity_score_idx on public.market_matches(similarity_score desc);
create index if not exists market_matches_is_best_match_idx on public.market_matches(is_best_match) where is_best_match = true;

-- Unique constraint: each market can only have ONE best match
create unique index if not exists market_matches_polymarket_best_match_idx 
  on public.market_matches(polymarket_id) 
  where is_best_match = true;

create unique index if not exists market_matches_kalshi_best_match_idx 
  on public.market_matches(kalshi_id) 
  where is_best_match = true;

comment on table public.market_matches is 'Stores similarity matches between Polymarket and Kalshi markets';
comment on column public.market_matches.similarity_score is 'Cosine similarity score (0-1), higher means more similar';
comment on column public.market_matches.is_best_match is 'True if this is the best 1-to-1 match for both markets';
