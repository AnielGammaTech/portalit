ALTER TABLE rocket_cyber_incidents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE rocket_cyber_incidents ADD COLUMN IF NOT EXISTS app_name TEXT;
ALTER TABLE rocket_cyber_incidents ADD COLUMN IF NOT EXISTS hostname TEXT;
ALTER TABLE rocket_cyber_incidents ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ;
