ALTER TABLE pax8_line_item_overrides ADD COLUMN IF NOT EXISTS group_id TEXT;
CREATE INDEX IF NOT EXISTS idx_pax8_overrides_group ON pax8_line_item_overrides(group_id) WHERE group_id IS NOT NULL;
