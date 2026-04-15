# Maestro CX-Roadmap

Erstellt: 2026-04-15
Letzte Aktualisierung: 2026-04-16

## Abgeschlossen

### Sprint 1: Dashboard + Create Wizard (15.04.2026)
- [x] SmartDatePicker Crash-Fix (isValid guards, 7 Stellen)
- [x] Dashboard: Radikal vereinfacht — nur Heute+Morgen offen, Urgent Strip, Quick Stats
- [x] Dashboard: Mobile-responsive (Sidebar stackt unter Timeline)
- [x] Dashboard: Vergangene Events ausgeblendet, nur nächste 30 Tage
- [x] Dashboard: "Warten auf Angebot" gekappt bei 21 Tagen
- [x] Create-Seite: 4-Step Wizard (Eingang → Kontakt → Angebot → Senden)
- [x] Create-Seite: Auto-advance nach Extraktion, Sticky Bottom-Nav
- [x] EventDetailsCard: Neue Event-Typen (Gruppenreservierung, Geburtstag, Hochzeit, Catering)

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
- [x] Team-Notification bei ALLEN Status (nicht nur 'new')
- [ ] Bestehende Testdaten markieren (SQL nach Migration)
- [ ] Bulk-Action "Als Test markieren" in Events-Liste

### Sprint 3: Event-Detail/Edit CX (15-16.04.2026) ← IN ARBEIT
- [x] Header: Kundenname + Avatar statt UUID
- [x] Header: Firma, Datum, Gäste als kompakte Info-Zeile
- [x] EmailStatusCard entfernt (redundant mit ConversationThread)
- [x] Quick-Action-Buttons (E-Mail, Zahlung, Vorschau) unter Header
- [x] EventDNA Card kollabierbar (default eingeklappt)
- [x] TEST-Badge bei Testbestellungen
- [x] ModeSelector: Kompakte Toggles (Menü|Paket|Nur E-Mail) statt riesige Karten
- [x] E-Mail-Modus im UI sichtbar + EmailComposer öffnet automatisch
- [x] CRITICAL FIX: useOfferBuilder flushSave (Menü wird vor Step-Wechsel gespeichert)
- [x] CRITICAL FIX: useOfferBuilder Syntax-Crash (flushSave + doppeltes return)
- [x] Mobile Wizard: safe-area-inset-bottom, h-12 Buttons, pb-32
- [x] Mobile Wizard: 1-spaltige Formulare (ContactDataCard + EventDetailsCard)
- [x] Mobile Wizard: Zurück-Label hidden auf Mobile (nur Pfeil)
- [x] Scroll-to-top bei Step-Wechsel
- [x] Auto-Save in DB bei Step-Wechsel (goToStep)
- [x] Step 3: "Zur Zusammenfassung" statt "Weiter" (klareres Label)
- [x] Step 4: Email-Draft Preview + "Bearbeiten" Link zurück zu Step 3
- [x] Step 4: Test-Warning Banner + Zurück-Button
- [x] Login-Redirect nach /admin statt auf /login bleiben
- [x] DishPicker: Freitext-Hinweis immer sichtbar
- [x] OfferBuilder: Menü-Bezeichnungen editierbar (Pencil-Icon + Inline-Input)
- [x] OfferBuilder: Eigene Gerichte als Freitext (DishPicker allowCustom=true)
- [x] OfferBuilder: Preise editierbar (PriceBreakdown overridePrice)
- [ ] OfferBuilder Mobile-Optimierung (Courses, DishPicker)
- [ ] Payment-Flow Übersicht
- [x] Timeline bereinigen (WhatsApp-Fehler HIDDEN_PROVIDERS Filter)
- [x] Sidebar mobile-responsive (DetailSidebar Komponenten-Extraktion + Expand/Collapse)
- [ ] Tab-Navigation (Angebot | Kommunikation | Aufgaben | Details)

## Offen

### Sprint 4: Messaging-System (aus Session 03.04.)
- [ ] email_messages Tabelle anlegen (Lovable)
- [ ] Ausgehende Mails in email_messages speichern
- [ ] ConversationThread UI-Komponente
- [ ] Resend Inbound einrichten
- [ ] Edge Function: receive-inbound-email
- [ ] Inline-Antwort aus Thread heraus senden

### Sprint 5: Zahlungsoptionen PublicOffer (aus Session 03.04.)
- [ ] PublicOffer: Komplett zahlen vs. 20% Anzahlung
- [ ] Stripe Checkout Session für Teilzahlung
- [ ] Stornobedingungen auf PublicOffer + events-storia.de FAQ

### Sprint 6-11: Events-Liste, Catering, Kalender, Küche, Angebote, Einstellungen, Navigation

## Technische Schulden
- [ ] SourcePanel.tsx und DraftPanel.tsx löschen
- [ ] event_end_date DB-Spalte aktivieren
- [ ] Refine useList is_test Filter in EventsList
- [ ] pg_cron Orphan Cleanup für Test-Drafts

## Regeln
- Email-Safety: Bei is_test=true → Emails NUR an antoine@monot.com
- Lovable für Supabase, Claude Code/Claude.ai für Frontend
- Git: Bei Lovable-Konflikten: git stash → pull --rebase → stash pop
- Terminal: Immer neuen Tab mit Cmd+T
- Claude macht alles selbstständig: Terminal, Browser-Tests, Lovable, Git
