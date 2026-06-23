/*
# Add increment_stat RPC function

## Overview
Creates a stored procedure that atomically increments a stat field for a user.
Used by edge functions to update statistics without race conditions.

## New Functions
- `increment_stat(user_id_input uuid, field text, amount integer)` - increments a stats column
  - Supports: total_requests, total_offers_sent, total_accepted, total_rejected, total_revenue
  - For total_revenue, amount is treated as numeric

## Security
- SECURITY DEFINER so edge functions (service role) can call it
- Only updates existing rows
*/

CREATE OR REPLACE FUNCTION increment_stat(
  user_id_input uuid,
  field text,
  amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF field = 'total_requests' THEN
    UPDATE stats SET total_requests = total_requests + amount, updated_at = now() WHERE user_id = user_id_input;
  ELSIF field = 'total_offers_sent' THEN
    UPDATE stats SET total_offers_sent = total_offers_sent + amount, updated_at = now() WHERE user_id = user_id_input;
  ELSIF field = 'total_accepted' THEN
    UPDATE stats SET total_accepted = total_accepted + amount, updated_at = now() WHERE user_id = user_id_input;
  ELSIF field = 'total_rejected' THEN
    UPDATE stats SET total_rejected = total_rejected + amount, updated_at = now() WHERE user_id = user_id_input;
  ELSIF field = 'total_revenue' THEN
    UPDATE stats SET total_revenue = total_revenue + amount, updated_at = now() WHERE user_id = user_id_input;
  END IF;
END;
$$;

-- Also add a numeric version for revenue
CREATE OR REPLACE FUNCTION increment_revenue(
  user_id_input uuid,
  amount numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE stats SET total_revenue = total_revenue + amount, updated_at = now() WHERE user_id = user_id_input;
END;
$$;
