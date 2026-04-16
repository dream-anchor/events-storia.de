# Maestro CX-Roadmap

Erstellt: 2026-04-15
Letzte Aktualisierung: 2026-04-16

## Abgeschlossen

### Sprint 1: Dashboard + Create Wizard (15.04.2026)
- [x] SmartDatePicker Crash-Fix (isValid guards, 7 Stellen)
- [x] Dashboard: Radikal vereinfacht — nur Heute+Morgen offen, Urgent Strip, Quick Stats
- [x] Dashboard: Mobile-responsive, vergangene Events ausgeblendet
- [x] Create-Seite: 4-Step Wizard (Eingang → Kontakt → Angebot → Senden)
- [x] Create-Seite: Auto-advance, Sticky Bottom-Nav, Scroll-to-top

### Sprint 2: Test-Mode (15.04.2026)
- [x] TestModeContext + localStorage + Toggle im Header
- [x] Dashboard + Hooks: is_test Filter
- [x] Checkbox "Als Test" im Wizard + TEST-Badge
- [x] Email-Safety Frontend + Backend (_shared/test-safety.ts via Lovable)
- [x] DB-Migration: is_test Spalte live

### Sprint 3: Event-Detail/Edit CX (15-16.04.2026) ← ABGESCHLOSSEN
- [x] Header: Kundenname + Avatar + Firma/Datum/Gäste Info-Zeile
- [x] Quick-Action-Buttons (E-Mail, Zahlung, Vorschau)
- [x] EventDNA Card kollabierbar (default eingeklappt)
- [x] ModeSelector v3: Restaurant-Menü | Eigenes Menü | Paket + Nur E-Mail Alternative
- [x] Restaurant-Menü öffnet direkt den Import-Dialog
- [x] DishPicker: Eigenes Gericht GANZ OBEN nach der Suche (PenLine Icon)
- [x] Gang löschen: Trash-Button immer sichtbar (onRemoveCourse)
- [x] Rabatt 0 = unsichtbar: Default 0%, Rabatt-Sektion hidden bei 0
- [x] Save-Status "Gespeichert/Speichert" entfernt
- [x] Versionshistorie entfernt (bereits in Timeline integriert als OfferVersionEntry)
- [x] Menüs bleiben editierbar (kein Lock) + Versions-Info Banner (grün)
- [x] "Direkt E-Mail schreiben" Link entfernt (redundant mit ModeSelector)
- [x] "Restaurant-Menü laden" Button entfernt (redundant mit ModeSelector)
- [x] OptionCard: Preis hidden bei 0 Gängen, "Option A" Text entfernt
- [x] OptionCard: Action-Icons haben Tooltips (title Attribut)
- [x] DetailSidebar Komponenten-Extraktion + Mobile Expand/Collapse
- [x] Timeline: WhatsApp-Fehler HIDDEN_PROVIDERS Filter
- [x] Timeline: Versionshistorie als expandierbare Amber-Karten (V1, V2, Menü-Details)
- [x] OfferBuilder: flushSave (Menü wird vor Step-Wechsel gespeichert)
- [x] Wizard: "Zur Zusammenfassung" statt "Weiter" auf Step 3
- [x] Wizard: Auto-Save bei Step-Wechsel, Login-Redirect

## Abgeschlossen

### Sprint 4: Tab-Navigation + OptionCard Redesign (16.04.2026) ← ABGESCHLOSSEN
- [x] Tab-Navigation (Angebot | Kommunikation | Aufgaben | Details)
- [x] OptionCard: GETRÄNKE als kompakte Zeile ("Getränke: Keine + hinzufügen")
- [x] Cleanup: SourcePanel, DraftPanel, DetailSidebar gelöscht (435 Zeilen)
- [x] Cleanup: Unused imports/state nach Tab-Umstellung
- [x] OfferBuilder Mobile-Optimierung (getestet: DishPicker, Tabs, OptionCard — alles gut)
- [x] OptionCard: Leere Gänge löschbar via Trash-Button (Default-Gänge = DB-Daten, nicht Code)
- [x] Payment-Flow: PaymentStatusStrip im Angebot-Tab mit 4 Zuständen + Navigation zu Details

## Offen

### Sprint 5: Messaging-System (16.04.2026) ← 95% abgeschlossen
- [x] email_messages Tabelle (bereits vorhanden, via früherem Lovable)
- [x] Ausgehende Mails in email_messages speichern (send-offer-email Zeile 332-335)
- [x] ConversationThread: Inline-Antwort senden (⌘↵, Status-Icons, Real-time)
- [x] Edge Function: receive-inbound-email (deployed, 3 Methoden zum Matching)
- [ ] Resend Inbound Webhook konfigurieren (Config, kein Code)
- [ ] Test: Kunde antwortet → Thread zeigt neue Nachricht in Real-time

### Sprint 6: Zahlungsoptionen PublicOffer
- [ ] Komplett zahlen vs. 20% Anzahlung
- [ ] Stornobedingungen auf PublicOffer + FAQ

## Offen

### Sprint 7+: Events-Liste, Catering, Kalender

## Technische Schulden
- [ ] SourcePanel.tsx und DraftPanel.tsx löschen
- [ ] pg_cron Orphan Cleanup für Test-Drafts
- [ ] Bulk-Action "Als Test markieren" in Events-Liste

## Regeln
- Email-Safety: Bei is_test=true → Emails NUR an antoine@monot.com
- Lovable für Supabase, Claude für Frontend
- Git: Bei Lovable-Konflikten: git stash → pull --rebase → stash pop
- Claude macht alles selbstständig: Terminal, Browser-Tests, Lovable, Git
