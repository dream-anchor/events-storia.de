# Maestro CX-Roadmap

Erstellt: 2026-04-15
Letzte Aktualisierung: 2026-04-15

## Abgeschlossen

### Sprint 1: Dashboard + Create Wizard (15.04.2026)
- [x] SmartDatePicker Crash-Fix (isValid guards, 7 Stellen)
- [x] Dashboard: Radikal vereinfacht — nur Heute+Morgen offen, Urgent Strip, Quick Stats
- [x] Dashboard: Mobile-responsive (Sidebar stackt unter Timeline)
- [x] Dashboard: Vergangene Events ausgeblendet, nur nächste 30 Tage
- [x] Dashboard: "Warten auf Angebot" gekappt bei 21 Tagen
- [x] Create-Seite: 4-Step Wizard (Eingang → Kontakt → Angebot → Senden)
- [x] Create-Seite: Auto-advance nach Extraktion, Sticky Bottom-Nav
- [x] Create-Seite: AI-Summary Banner in Step 2
- [x] EventDetailsCard: Neue Event-Typen (Gruppenreservierung, Geburtstag, Hochzeit, Catering)
- [x] Dashboard TimelineGroup: parseISO → safeParse

### Sprint 2: Test-Mode (15.04.2026)
- [x] TestModeContext + localStorage Persistence
- [x] Toggle im Admin-Header
- [x] Dashboard Query-Filter (is_test)
- [x] Hooks: useEventInquiries, useNewInquiriesCount, useCateringOrders, usePendingOrdersCount
- [x] Checkbox "Als Test" im Create-Wizard (Step 1)
- [x] Email-Safety Frontend: Test-Emails → antoine@monot.com, [TEST] Prefix
- [x] TEST-Badge im Wizard-Header
- [x] DB-Migration: is_test Spalte → Lovable-Migration live
- [x] Email-Safety Edge Functions → Lovable deployed (_shared/test-safety.ts)
- [ ] Bestehende Testdaten markieren (SQL nach Migration)
- [ ] TEST-Badge + Toggle im Event-Detail-View
- [ ] Bulk-Action "Als Test markieren" in Events-Liste

## Offen

### Sprint 3: Event-Detail/Edit CX ← IN ARBEIT
Der Screen wo 80% der Arbeitszeit verbracht wird.
- [x] Header: Kundenname + Avatar statt UUID
- [x] Header: Firma, Datum, Gäste als kompakte Info-Zeile
- [x] EmailStatusCard entfernt (redundant mit ConversationThread)
- [x] Mobile Wizard: safe-area-inset-bottom, h-12 Buttons, pb-32
- [x] Mobile Wizard: Zurück-Label hidden auf Mobile (nur Pfeil)
- [x] Test-Email Bug: Team-Notification bei ALLEN Status (nicht nur 'new')
- [x] Test-Email Bug: receive-event-inquiry auch bei offer_sent aufrufen
- [x] Step 4: Email-Draft Preview + "Bearbeiten" Link zurück zu Step 3
- [x] Step 4: Test-Warning Banner mit Redirect-Email-Info
- [x] Step 4: Buttons full-width h-12 (mobile-optimiert)
- [ ] Quick-Action-Buttons (Email, Zahlung, Preview) unter Detail-Header
- [ ] EventDNA Card kollabierbar (Kompakt-Modus default)
- [ ] Tab-Navigation (Angebot | Kommunikation | Aufgaben | Details)
- [x] OfferBuilder: Menü-Bezeichnungen editierbar (Pencil-Icon + Inline-Input)
- [x] OfferBuilder: Eigene Gerichte als Freitext (DishPicker allowCustom=true, war schon da)
- [ ] OfferBuilder Mobile-Optimierung (Courses, DishPicker)
- [ ] Payment-Flow Übersicht
- [ ] Timeline bereinigen (Autosave-Spam, WhatsApp-Fehler filtern)
- [ ] TEST-Badge + is_test Toggle im Detail-View
- [ ] Sidebar mobile-responsive

### Sprint 4: Messaging-System (aus Session 03.04.)
Resend Inbound + ConversationThread — geplant, noch nicht gebaut.
- [ ] email_messages Tabelle anlegen (Lovable)
- [ ] Ausgehende Mails in email_messages speichern (send-offer-email erweitern)
- [ ] ConversationThread UI-Komponente (ersetzt EmailStatusCard)
- [ ] Resend Inbound einrichten (DNS MX oder reply.events-storia.de)
- [ ] Edge Function: receive-inbound-email
- [ ] Eingehende Mails in Thread anzeigen
- [ ] Inline-Antwort aus Thread heraus senden

### Sprint 5: Zahlungsoptionen PublicOffer (aus Session 03.04.)
Kunden sollen auf der Angebotsseite selbst wählen können.
- [ ] PublicOffer: Komplett zahlen vs. 20% Anzahlung (bei Menü-Modus)
- [ ] Stripe Checkout Session für Teilzahlung
- [ ] Payment-Tracking: deposit → prepayment → final Flow
- [ ] Stornobedingungen auf PublicOffer anzeigen
- [ ] Stornobedingungen in events-storia.de FAQ

### Sprint 6: Events-Liste CX
- [ ] Filter-UX vereinfachen
- [ ] Tabellen-/Kanban-Ansicht bereinigen
- [ ] Suchfunktion verbessern
- [ ] is_test Filter in Refine useList Query
- [ ] Archiv-Logik (alte Events automatisch archivieren?)

### Sprint 7: Catering-Orders CX
- [ ] Bestellübersicht redesignen
- [ ] Bestelldetail-Ansicht
- [ ] Status-Flow vereinfachen

### Sprint 8: Kalender + Küchen-Ansicht (aus Dashboard-Spec 08.04.)
- [ ] Monatskalender mit Events als Blöcken + Zahlungs-Fälligkeiten als Marker
- [ ] Küchen-Ansicht: Reduziert — nur Datum, Uhrzeit, Gästeanzahl, Menü, Sonderwünsche
      (Kein Zahlungsstatus, keine Kontaktdaten. Für iPad in der Küche.)

### Sprint 9: Angebote + Rechnungen
- [ ] LexOffice-Integration UX
- [ ] Dokumenten-Übersicht

### Sprint 10: Einstellungen
- [ ] Benutzer-Management
- [ ] Email-Templates Editor
- [ ] Paket-Editor

### Sprint 11: Navigation + Gesamtbild
- [ ] Floating Pill Nav
- [ ] Mobile Navigation optimieren
- [ ] Übergänge zwischen Screens
- [ ] Consistent Design Language über alle Screens

## Technische Schulden
- [ ] SourcePanel.tsx und DraftPanel.tsx löschen (nicht mehr importiert seit Wizard-Rewrite)
- [ ] event_end_date DB-Spalte aktivieren + Code uncomment in saveInquiry
- [ ] Refine useList Query in EventsList mit is_test Filter erweitern
- [ ] pg_cron Orphan Cleanup für Test-Drafts anpassen
- [ ] SmartDatePicker: showQuickChips=false Pfad hat noch ungeschützte format()-Aufrufe prüfen

## Regeln
- **Email-Safety:** Bei is_test=true werden E-Mails NUR an System-User gesendet:
  - antoine@monot.com (Redirect-Ziel)
  - info@ristorantestoria.de
  - info@events-storia.de
- **Lovable für Supabase:** Alle DB-Migrationen und Edge Functions über Lovable
- **Claude Code / Claude.ai für Frontend:** Alle React-Komponenten
- **Git Workflow:** Bei Lovable-Konflikten: git stash → pull --rebase → stash pop
- **Terminal:** Immer neuen Tab mit Cmd+T, nie neues Fenster
