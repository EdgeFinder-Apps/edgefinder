-- Adjust confidence threshold to show more results while still filtering bad matches

-- Recreate view with lower confidence threshold
DROP VIEW IF EXISTS verified_arbitrage_opportunities;

CREATE OR REPLACE VIEW verified_arbitrage_opportunities AS
SELECT 
  pm.question as polymarket_question,
  km.title as kalshi_title,
  mm.similarity_score,
  ROUND((pm.last_trade_price * 100)::numeric, 2) as poly_price_cents,
  km.last_price as kalshi_price_cents,
  ROUND(ABS((pm.last_trade_price * 100) - km.last_price)::numeric, 2) as price_diff_cents,
  mm.direction_aligned,
  mm.direction_confidence,
  mm.direction_notes,
  pm.slug as poly_slug,
  km.ticker as kalshi_ticker,
  pm.end_date as poly_end_date,
  km.expiration_time as kalshi_expiration_time
FROM market_matches mm
JOIN polymarket_markets pm ON mm.polymarket_id = pm.id
JOIN kalshi_markets km ON mm.kalshi_id = km.id
WHERE mm.is_best_match = true
  AND pm.last_trade_price IS NOT NULL
  AND km.last_price IS NOT NULL
  AND mm.direction_aligned = true  -- Only aligned directions (not opposites)
  AND mm.direction_confidence >= 0.5  -- Medium confidence (excludes obvious mismatches)
  AND ABS((pm.last_trade_price * 100) - km.last_price) >= 5  -- At least 5% spread
ORDER BY 
  mm.direction_confidence DESC,  -- Show highest confidence first
  ABS((pm.last_trade_price * 100) - km.last_price) DESC;

COMMENT ON VIEW verified_arbitrage_opportunities IS 
'Shows market matches with aligned directions (50%+ confidence) and price spreads (5%+). Higher confidence = more likely to be true arbitrage.';

-- Also create a "needs review" view for borderline cases
CREATE OR REPLACE VIEW arbitrage_needs_review AS
SELECT 
  pm.question as polymarket_question,
  km.title as kalshi_title,
  mm.similarity_score,
  ROUND((pm.last_trade_price * 100)::numeric, 2) as poly_price_cents,
  km.last_price as kalshi_price_cents,
  ROUND(ABS((pm.last_trade_price * 100) - km.last_price)::numeric, 2) as price_diff_cents,
  mm.direction_aligned,
  mm.direction_confidence,
  mm.direction_notes,
  pm.slug as poly_slug,
  km.ticker as kalshi_ticker
FROM market_matches mm
JOIN polymarket_markets pm ON mm.polymarket_id = pm.id
JOIN kalshi_markets km ON mm.kalshi_id = km.id
WHERE mm.is_best_match = true
  AND pm.last_trade_price IS NOT NULL
  AND km.last_price IS NOT NULL
  AND (
    mm.direction_aligned = false  -- Opposite directions detected
    OR mm.direction_confidence < 0.5  -- Low confidence
  )
  AND ABS((pm.last_trade_price * 100) - km.last_price) >= 10  -- Large spread might indicate issue
ORDER BY ABS((pm.last_trade_price * 100) - km.last_price) DESC;

COMMENT ON VIEW arbitrage_needs_review IS 
'Shows market matches that need manual review due to opposite framing or low confidence, but have large price spreads.';
