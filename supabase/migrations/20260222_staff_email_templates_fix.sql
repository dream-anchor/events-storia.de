-- =============================================
-- Fix: Staff darf E-Mail-Vorlagen nutzen aber nicht löschen
-- Ersetzt die FOR ALL Policy durch granulare Policies
-- =============================================

-- Alte Policy entfernen
DROP POLICY IF EXISTS "Staff can manage email_templates" ON public.email_templates;

-- Granulare Policies: SELECT, INSERT, UPDATE (kein DELETE)
CREATE POLICY "Staff can view email_templates"
  ON public.email_templates FOR SELECT
  USING (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can create email_templates"
  ON public.email_templates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff can update email_templates"
  ON public.email_templates FOR UPDATE
  USING (has_role(auth.uid(), 'staff'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- DELETE nur für Admin (existierende Admin-Policy deckt das ab)
