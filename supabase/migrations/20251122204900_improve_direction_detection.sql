-- Fix direction alignment detection with better keyword matching

DROP FUNCTION IF EXISTS detect_direction_alignment(text, text);

CREATE OR REPLACE FUNCTION detect_direction_alignment(
  poly_question text,
  kalshi_question text
)
RETURNS TABLE(
  aligned boolean,
  confidence real,
  notes text
) AS $$
DECLARE
  poly_lower text;
  kalshi_lower text;
  poly_negated boolean := false;
  kalshi_negated boolean := false;
  negation_keywords text[] := ARRAY['not', 'no longer', 'won''t', 'doesn''t', 'will not', 'cannot', 'can''t', 'never', 'without', 'fail to', 'refuse'];
  opposite_pairs text[][] := ARRAY[
    ARRAY['remain', 'leave'],
    ARRAY['remain', 'no longer'],
    ARRAY['stay', 'out'],
    ARRAY['keep', 'lose'],
    ARRAY['win', 'lose'],
    ARRAY['more than', 'less than'],
    ARRAY['greater than', 'less than'],
    ARRAY['above', 'below'],
    ARRAY['over', 'under'],
    ARRAY['exceed', 'below'],
    ARRAY['before', 'after']
  ];
  threshold_mismatch boolean := false;
  keyword text;
  pair text[];
  result_aligned boolean := true;
  result_confidence real := 0.5;
  result_notes text := '';
BEGIN
  -- Normalize text
  poly_lower := lower(poly_question);
  kalshi_lower := lower(kalshi_question);
  
  -- Check for negation keywords in each question
  FOREACH keyword IN ARRAY negation_keywords LOOP
    IF position(keyword IN poly_lower) > 0 THEN
      poly_negated := true;
    END IF;
    IF position(keyword IN kalshi_lower) > 0 THEN
      kalshi_negated := true;
    END IF;
  END LOOP;
  
  -- Check for opposite word pairs
  FOREACH pair SLICE 1 IN ARRAY opposite_pairs LOOP
    IF (position(pair[1] IN poly_lower) > 0 AND position(pair[2] IN kalshi_lower) > 0) OR
       (position(pair[2] IN poly_lower) > 0 AND position(pair[1] IN kalshi_lower) > 0) THEN
      result_aligned := false;
      result_confidence := 0.85;
      result_notes := format('Opposite words detected: "%s" vs "%s"', pair[1], pair[2]);
      RETURN QUERY SELECT result_aligned, result_confidence, result_notes;
      RETURN;
    END IF;
  END LOOP;
  
  -- Check for numerical threshold mismatches
  -- Example: "any member" vs "5 members", "1 cabinet" vs "5 cabinet"
  IF (poly_lower ~ 'member' AND kalshi_lower ~ '\d+\s*members?') OR
     (kalshi_lower ~ 'member' AND poly_lower ~ '\d+\s*members?') THEN
    -- Check if one asks about ANY/A and other asks about specific number
    IF ((position('any' IN poly_lower) > 0 OR poly_lower ~ '\ba\b') AND kalshi_lower ~ '\d+') OR
       ((position('any' IN kalshi_lower) > 0 OR kalshi_lower ~ '\ba\b') AND poly_lower ~ '\d+') THEN
      threshold_mismatch := true;
    END IF;
  END IF;
  
  IF threshold_mismatch THEN
    result_aligned := false;
    result_confidence := 0.75;
    result_notes := 'Threshold/quantity mismatch detected (e.g., "any" vs specific number)';
    RETURN QUERY SELECT result_aligned, result_confidence, result_notes;
    RETURN;
  END IF;
  
  -- If one question is negated and the other isn't, they're likely opposite
  IF poly_negated != kalshi_negated THEN
    result_aligned := false;
    result_confidence := 0.8;
    result_notes := 'One question is negated, the other is not';
    RETURN QUERY SELECT result_aligned, result_confidence, result_notes;
    RETURN;
  END IF;
  
  -- Check for timeframe mismatches that could explain price differences
  IF (poly_lower ~ '(by|before) (january|february|march|april|may|june|july|august|september|october|november|december|\d{4})') AND
     (kalshi_lower ~ '(during|throughout|by end of|presidency)') THEN
    -- Different specific dates might explain price difference
    result_confidence := 0.45; -- Lower confidence, needs manual review
    result_notes := 'Different timeframes detected - may explain price difference';
  ELSE
    -- Assume aligned with medium confidence
    result_confidence := 0.55;
    result_notes := 'No clear direction mismatch detected - manual review recommended';
  END IF;
  
  result_aligned := true;
  RETURN QUERY SELECT result_aligned, result_confidence, result_notes;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- If any existing matches need updating
UPDATE market_matches mm
SET 
  direction_aligned = da.aligned,
  direction_confidence = da.confidence,
  direction_notes = da.notes
FROM polymarket_markets pm, kalshi_markets km,
     LATERAL detect_direction_alignment(pm.question, km.title) da
WHERE mm.polymarket_id = pm.id 
  AND mm.kalshi_id = km.id;

-- Update the verified arbitrage view to require higher confidence
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
  AND mm.direction_aligned = true  -- Only aligned directions
  AND mm.direction_confidence >= 0.7  -- High confidence only (excludes timeframe/threshold mismatches)
  AND ABS((pm.last_trade_price * 100) - km.last_price) >= 5  -- At least 5% spread
ORDER BY ABS((pm.last_trade_price * 100) - km.last_price) DESC;

COMMENT ON VIEW verified_arbitrage_opportunities IS 
'Shows only market matches with aligned question directions (70%+ confidence) and significant price spreads (5%+)';
