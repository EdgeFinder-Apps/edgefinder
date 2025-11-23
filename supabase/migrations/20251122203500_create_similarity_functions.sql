-- Function to find top N similar Kalshi markets for a given Polymarket market
create or replace function find_similar_kalshi_markets(
  polymarket_market_id uuid,
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  kalshi_id uuid,
  kalshi_ticker text,
  kalshi_title text,
  similarity_score float
)
language sql
stable
as $$
  select 
    k.id as kalshi_id,
    k.ticker as kalshi_ticker,
    k.title as kalshi_title,
    1 - (p.embedding <=> k.embedding) as similarity_score
  from polymarket_markets p
  cross join kalshi_markets k
  where p.id = polymarket_market_id
    and p.embedding is not null
    and k.embedding is not null
    and 1 - (p.embedding <=> k.embedding) >= match_threshold
  order by p.embedding <=> k.embedding asc
  limit least(match_count, 200);
$$;

comment on function find_similar_kalshi_markets is 'Find the most similar Kalshi markets for a given Polymarket market using cosine similarity';

-- Function to find top N similar Polymarket markets for a given Kalshi market
create or replace function find_similar_polymarket_markets(
  kalshi_market_id uuid,
  match_threshold float default 0.7,
  match_count int default 10
)
returns table (
  polymarket_id uuid,
  polymarket_slug text,
  polymarket_question text,
  similarity_score float
)
language sql
stable
as $$
  select 
    p.id as polymarket_id,
    p.slug as polymarket_slug,
    p.question as polymarket_question,
    1 - (k.embedding <=> p.embedding) as similarity_score
  from kalshi_markets k
  cross join polymarket_markets p
  where k.id = kalshi_market_id
    and k.embedding is not null
    and p.embedding is not null
    and 1 - (k.embedding <=> p.embedding) >= match_threshold
  order by k.embedding <=> p.embedding asc
  limit least(match_count, 200);
$$;

comment on function find_similar_polymarket_markets is 'Find the most similar Polymarket markets for a given Kalshi market using cosine similarity';

-- Function to compute ALL potential matches and store in market_matches table
create or replace function compute_all_market_matches(
  match_threshold float default 0.7,
  top_n_per_market int default 5
)
returns table (
  total_matches bigint,
  polymarket_count bigint,
  kalshi_count bigint
)
language plpgsql
as $$
declare
  poly_count bigint;
  kalshi_count bigint;
  total bigint;
begin
  -- Clear existing non-best matches to recompute
  delete from market_matches where is_best_match = false;
  
  -- Insert all potential matches from Polymarket -> Kalshi
  insert into market_matches (polymarket_id, kalshi_id, similarity_score, is_best_match)
  select 
    p.id as polymarket_id,
    k.id as kalshi_id,
    1 - (p.embedding <=> k.embedding) as similarity_score,
    false as is_best_match
  from polymarket_markets p
  cross join lateral (
    select k.id, k.embedding
    from kalshi_markets k
    where k.embedding is not null
      and 1 - (p.embedding <=> k.embedding) >= match_threshold
    order by p.embedding <=> k.embedding asc
    limit top_n_per_market
  ) k
  where p.embedding is not null
  on conflict (polymarket_id, kalshi_id) 
  do update set 
    similarity_score = excluded.similarity_score,
    updated_at = now();
  
  -- Get counts
  select count(distinct polymarket_id) into poly_count from market_matches;
  select count(distinct kalshi_id) into kalshi_count from market_matches;
  select count(*) into total from market_matches;
  
  return query select total, poly_count, kalshi_count;
end;
$$;

comment on function compute_all_market_matches is 'Compute all potential matches above threshold and store in market_matches table';

-- Function to resolve to 1-to-1 best matches using greedy assignment
create or replace function resolve_best_matches(
  min_similarity float default 0.75
)
returns table (
  best_matches_count bigint,
  avg_similarity float
)
language plpgsql
as $$
declare
  match_record record;
  matches_count bigint := 0;
  total_similarity float := 0;
begin
  -- Reset all best_match flags
  update market_matches set is_best_match = false;
  
  -- Pick highest similarity matches first
  -- and ensure 1-to-1 constraint
  for match_record in (
    select 
      mm.id,
      mm.polymarket_id,
      mm.kalshi_id,
      mm.similarity_score
    from market_matches mm
    where mm.similarity_score >= min_similarity
    order by mm.similarity_score desc
  )
  loop
    -- Check if either market is already matched
    if not exists (
      select 1 from market_matches
      where is_best_match = true
        and (polymarket_id = match_record.polymarket_id 
             or kalshi_id = match_record.kalshi_id)
    ) then
      -- Mark this as best match
      update market_matches
      set is_best_match = true, updated_at = now()
      where id = match_record.id;
      
      matches_count := matches_count + 1;
      total_similarity := total_similarity + match_record.similarity_score;
    end if;
  end loop;
  
  return query select 
    matches_count,
    case when matches_count > 0 then total_similarity / matches_count else 0 end as avg_similarity;
end;
$$;

comment on function resolve_best_matches is 'Resolve many-to-many matches into 1-to-1 best matches using greedy algorithm';

-- Run the full pipeline
create or replace function refresh_market_matches(
  match_threshold float default 0.7,
  top_n_per_market int default 5,
  min_best_match_similarity float default 0.75
)
returns jsonb
language plpgsql
as $$
declare
  compute_result record;
  resolve_result record;
begin
  -- Compute all potential matches
  select * into compute_result from compute_all_market_matches(match_threshold, top_n_per_market);
  
  -- Resolve to 1-to-1 best matches
  select * into resolve_result from resolve_best_matches(min_best_match_similarity);
  
  return jsonb_build_object(
    'total_potential_matches', compute_result.total_matches,
    'polymarket_markets_with_matches', compute_result.polymarket_count,
    'kalshi_markets_with_matches', compute_result.kalshi_count,
    'best_matches_count', resolve_result.best_matches_count,
    'avg_best_match_similarity', resolve_result.avg_similarity
  );
end;
$$;

comment on function refresh_market_matches is 'Full pipeline: compute all potential matches and resolve to 1-to-1 best matches';
