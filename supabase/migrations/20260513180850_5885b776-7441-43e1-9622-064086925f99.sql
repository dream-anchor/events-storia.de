-- 1) Enums erweitern
ALTER TYPE v2_event_service ADD VALUE IF NOT EXISTS 'group';
ALTER TYPE v2_event_source ADD VALUE IF NOT EXISTS 'reisegruppen';
