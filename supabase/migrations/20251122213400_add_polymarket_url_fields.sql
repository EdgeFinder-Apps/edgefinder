-- Add fields needed for proper Polymarket URL format
alter table public.polymarket_markets 
  add column if not exists group_item_title text,
  add column if not exists condition_id text,
  add column if not exists event_slug text;

comment on column public.polymarket_markets.group_item_title is 'Parent market title for multi-outcome markets (used for URL construction)';
comment on column public.polymarket_markets.condition_id is 'Condition ID linking outcomes to parent market';
comment on column public.polymarket_markets.event_slug is 'Parent event slug from events[0].slug for multi-outcome markets';
