-- Add direction alignment tracking to market_matches table

-- Add columns to track question direction alignment
ALTER TABLE market_matches 
ADD COLUMN IF NOT EXISTS direction_aligned boolean,
ADD COLUMN IF NOT EXISTS direction_confidence real,
ADD COLUMN IF NOT EXISTS direction_notes text;

-- Function to detect opposite framing using keyword analysis
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
    ARRAY['before', 'after'],
    ARRAY['member', 'members'],
    ARRAY['any', 'all']
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
  
  -- Check for numerical threshold mismatches (different numbers in questions)
  -- Extract if one has specific number and other doesn't or has different number
  IF (poly_lower ~ '\d+' AND kalshi_lower ~ '\d+') THEN
    -- Heuristic check for things like "1 member" vs "5 members"
    IF (position('any' IN poly_lower) > 0 OR position('at least' IN poly_lower) > 0) AND 
       (position('all' IN kalshi_lower) > 0 OR kalshi_lower ~ '\d+.*and') THEN
      threshold_mismatch := true;
    END IF;
  END IF;
  
  IF threshold_mismatch THEN
    result_aligned := false;
    result_confidence := 0.7;
    result_notes := 'Possible threshold/quantity mismatch detected';
    RETURN QUERY SELECT result_aligned, result_confidence, result_notes;
    RETURN;
  END IF;
  
  -- Negation in one and not the other is probably a mismatch
  IF poly_negated != kalshi_negated THEN
    result_aligned := false;
    result_confidence := 0.7;
    result_notes := 'One question is negated, the other is not';
    RETURN QUERY SELECT result_aligned, result_confidence, result_notes;
    RETURN;
  END IF;
  
  -- Check for timeframe mismatches that could explain price differences
  IF (poly_lower ~ '(by|before) (january|february|march|april|may|june|july|august|september|october|november|december|\d{4})') AND
     (kalshi_lower ~ '(during|throughout|by end of|before \d{4})') THEN
    -- Different specific dates might explain price difference
    result_confidence := 0.4; -- Lower confidence, needs manual review
    result_notes := 'Different timeframes detected - may explain price difference';
  ELSE
    -- Assume aligned with medium-low confidence
    result_confidence := 0.5;
    result_notes := 'No clear direction mismatch detected - manual review recommended';
  END IF;
  
  result_aligned := true;
  RETURN QUERY SELECT result_aligned, result_confidence, result_notes;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing matches with direction alignment analysis
UPDATE market_matches mm
SET 
  direction_aligned = da.aligned,
  direction_confidence = da.confidence,
  direction_notes = da.notes
FROM polymarket_markets pm, kalshi_markets km,
     LATERAL detect_direction_alignment(pm.question, km.title) da
WHERE mm.polymarket_id = pm.id 
  AND mm.kalshi_id = km.id;

-- Create index for filtering by alignment
CREATE INDEX IF NOT EXISTS idx_market_matches_direction_aligned 
ON market_matches(direction_aligned) 
WHERE is_best_match = true;

-- Create a view for verified arbitrage opportunities (aligned directions only)
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
  AND mm.direction_confidence >= 0.7  -- High confidence only (excludes timeframe mismatches)
  AND ABS((pm.last_trade_price * 100) - km.last_price) >= 5  -- At least 5% spread
ORDER BY ABS((pm.last_trade_price * 100) - km.last_price) DESC;

COMMENT ON VIEW verified_arbitrage_opportunities IS 
'Shows only market matches with aligned question directions and significant price spreads';
