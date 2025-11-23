-- Add WHERE clause to UPDATE statements in resolve_best_matches function
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
  update market_matches set is_best_match = false where is_best_match = true;
  
  -- Pick highest similarity matches first and ensure 1-to-1 constraint
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
