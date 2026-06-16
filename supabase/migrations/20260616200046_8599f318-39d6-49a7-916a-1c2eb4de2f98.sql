-- Defensive Cleanup: falls jemals zu breite Policies für den Bucket
-- 'cost-acceptances' angelegt wurden, werden sie hier entfernt.
-- Es werden bewusst KEINE neuen Policies für anon oder authenticated angelegt:
--   * anon  -> kein Zugriff (default deny via RLS auf storage.objects)
--   * authenticated -> kein direkter Storage-Zugriff; Downloads laufen
--     ausschließlich über die auth-geschützte Edge Function
--     `download-signed-cost-acceptance`, die mit der Service Role signierte
--     URLs erzeugt. Die Service Role ignoriert RLS und kann weiterhin
--     uploaden, lesen und Signed URLs erstellen.

DROP POLICY IF EXISTS "cost_acceptances_public_read"        ON storage.objects;
DROP POLICY IF EXISTS "cost_acceptances_anon_read"          ON storage.objects;
DROP POLICY IF EXISTS "cost_acceptances_anon_select"        ON storage.objects;
DROP POLICY IF EXISTS "cost_acceptances_authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "cost_acceptances_authenticated_all"  ON storage.objects;
DROP POLICY IF EXISTS "cost_acceptances_all_access"         ON storage.objects;
DROP POLICY IF EXISTS "Public read cost-acceptances"        ON storage.objects;
