-- Soft-Delete für menu_items und menu_categories
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index für performante Abfragen (nur nicht-gelöschte Items)
CREATE INDEX IF NOT EXISTS idx_menu_items_deleted_at ON menu_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_menu_categories_deleted_at ON menu_categories(deleted_at);

-- Auto-Purge: Items älter als 60 Tage endgültig löschen
CREATE OR REPLACE FUNCTION purge_deleted_menu_items()
RETURNS void AS $$
BEGIN
  DELETE FROM menu_items WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '60 days';
  DELETE FROM menu_categories WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
