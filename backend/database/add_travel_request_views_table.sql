-- Create table to track which users have viewed which travel requests
CREATE TABLE IF NOT EXISTS travel_request_views (
  id BIGSERIAL PRIMARY KEY,
  travel_request_id BIGINT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(travel_request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_travel_request_views_request ON travel_request_views(travel_request_id);
CREATE INDEX IF NOT EXISTS idx_travel_request_views_user ON travel_request_views(user_id);
