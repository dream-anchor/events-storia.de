# Maestro CX-Roadmap

Erstellt: 2026-04-15
Letzte Aktualisierung: 2026-04-15

## Abgeschlossen

### Sprint 1: Dashboard + Create Wizard (15.04.2026)
- [x] SmartDatePicker Crash-Fix (isValid guards)
- [x] Dashboard: Radikal vereinfacht — nur Heute+Morgen offen, Urgent Strip, Quick Stats
- [x] Dashboard: Mobile-responsive (Sidebar stackt)
- [x] Create-Seite: 4-Step Wizard (Eingang → Kontakt → Angebot → Senden)
- [x] Create-Seite: Auto-advance nach Extraktion, Sticky Bottom-Nav
- [x] EventDetailsCard: Neue Event-Typen

### Sprint 2: Test-Mode (15.04.2026)
- [x] TestModeContext + localStorage Persistence
- [x] Toggle im Admin-Header
- [x] Dashboard Query-Filter (is_test)
- [x] Hooks: useEventInquiries, useNewInquiriesCount, useCateringOrders, usePendingOrdersCount
- [x] Checkbox "Als Test" im Create-Wizard (Step 1)
- [x] Email-Safety Frontend: Test-Emails → antoine@monot.com
- [x] TEST-Badge im Wizard-Header
- [ ] DB-Migration: is_test Spalte → Lovable-Prompt in docs/lovable-prompt-test-flag.md
- [ ] Email-Safety Edge Functions → Lovable-Prompt in docs/lovable-prompt-email-safety.md
- [ ] Bestehende Testdaten markieren (SQL)
- [ ] TEST-Badge + Toggle im Event-Detail
- [ ] Bulk-Action "Als Test markieren" in Events-Liste

## Offen

### Sprint 3: Event-Detail/Edit CX
- [ ] Screen-Audit: Was ist verwirrend, was fehlt?
- [ ] OfferBuilder UX-Verbesserungen
- [ ] Payment-Flow Übersicht (Anzahlung/Vorauszahlung/Restzahlung)
- [ ] Mobile-Optimierung des Edit-Views
- [ ] Email-Composer Vereinfachung
- [ ] Timeline/History bereinigen

### Sprint 4: Events-Liste CX
- [ ] Filter-UX vereinfachen
- [ ] Tabellen-/Kanban-Ansicht bereinigen
- [ ] Suchfunktion verbessern
- [ ] Archiv-Logik (alte Events automatisch archivieren?)

### Sprint 5: Catering-Orders CX
- [ ] Bestellübersicht redesignen
- [ ] Bestelldetail-Ansicht
- [ ] Status-Flow vereinfachen

### Sprint 6: Angebote + Rechnungen
- [ ] LexOffice-Integration UX
- [ ] Dokumenten-Übersicht

### Sprint 7: Einstellungen
- [ ] Benutzer-Management
- [ ] Email-Templates
- [ ] Paket-Editor

### Sprint 8: Navigation + Gesamtbild
- [ ] Floating Pill Nav
- [ ] Mobile Navigation
- [ ] Übergänge zwischen Screens
- [ ] Consistent Design Language

## Technische Schulden
- [ ] SourcePanel.tsx und DraftPanel.tsx löschen (nicht mehr importiert)
- [ ] event_end_date DB-Spalte + Code aktivieren (TODO im saveInquiry)
- [ ] Refine useList Query in EventsList mit is_test Filter erweitern
- [ ] pg_cron Orphan Cleanup für Test-Drafts anpassen

## Regeln
- **Email-Safety:** Bei is_test=true werden E-Mails NUR an System-User gesendet:
  - antoine@monot.com
  - mimmo@ristorantestoria.de (oder Mimmos tatsächliche E-Mail)
  - mahdina@ (E-Mail-Adresse noch bestätigen)
- **Lovable für Supabase:** Alle DB-Migrationen und Edge Functions über Lovable
- **Claude Code für Frontend:** Alle React-Komponenten über Claude Code / direkte Edits
- **Git Workflow:** Bei Lovable-Konflikten: git stash → pull --rebase → stash pop
