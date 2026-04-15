# Lovable Prompt: Test-Flag Migration

Erstelle eine Supabase Migration die folgendes macht:

1. Füge eine `is_test` Spalte zu `event_inquiries` hinzu:
```sql
ALTER TABLE public.event_inquiries 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;
```

2. Füge eine `is_test` Spalte zu `catering_orders` hinzu:
```sql
ALTER TABLE public.catering_orders 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;
```

3. Erstelle einen Index für schnelle Filterung:
```sql
CREATE INDEX IF NOT EXISTS idx_event_inquiries_is_test ON public.event_inquiries (is_test) WHERE is_test = true;
CREATE INDEX IF NOT EXISTS idx_catering_orders_is_test ON public.catering_orders (is_test) WHERE is_test = true;
```

4. KEINE RLS-Änderungen nötig — die bestehenden Policies decken die neue Spalte ab.

5. Markiere bestehende Test-Einträge (optional — manuell per SQL ausführen):
```sql
-- Alle Einträge mit "test" im Namen als Test markieren
UPDATE event_inquiries SET is_test = true 
WHERE LOWER(contact_name) LIKE '%test%' 
   OR LOWER(company_name) LIKE '%test%'
   OR LOWER(email) LIKE '%test%';

UPDATE catering_orders SET is_test = true 
WHERE LOWER(customer_name) LIKE '%test%' 
   OR LOWER(customer_email) LIKE '%test%';
```
