-- Archiv für saisonale Speisen/Kategorien (kein Auto-Löschen, dauerhaft aufbewahrt)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_archived_at ON menu_items(archived_at);
CREATE INDEX IF NOT EXISTS idx_menu_categories_archived_at ON menu_categories(archived_at);
