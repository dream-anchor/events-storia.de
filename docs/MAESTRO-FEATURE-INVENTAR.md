# MAESTRO Alt-System: Vollständiges Funktions-Inventar

> Automatische Vollinventur 2026-07-05 (Workflow wf_6092511b-ed5, 6 Agenten, 314 Datei-Zugriffe).
> **393 Funktionen.** Grundlage der Gap-Analyse im MAESTRO-SAAS-PLAYBOOK.md.

## Angebot (26)

- **KI-generiertes Angebots-Anschreiben** · 🔴 täglich  
  Generiert per KI (Gemini) ein personalisiertes Anschreiben für ein Angebot inkl. Absender-Signaturen der Team-Mitglieder (Name, Mobilnummer) und Zusammenfassung der Angebots-Optionen; Firmen-Footer kommt aus den E-Mail-Templates.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/generate-inquiry-email/index.ts`_
- **KI-Menüvorschlag für Anfrage** · 🟠 regelmäßig  
  Erstellt per KI einen passenden Menü-/Paketvorschlag für eine Anfrage aus dem kombinierten Catering- und Restaurant-Katalog (Vegetarisch/Vegan-Flags, Preise, Serviervorschläge).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/generate-menu-suggestion/index.ts`_
- **Freitext-Angebot parsen (KI)** · 🟠 regelmäßig  
  Wandelt einen vorformulierten Angebotstext (z.B. mehrtägige Catering-Programme) per Gemini 2.5 Pro in ein strukturiertes Programm um — Preise und Texte 1:1, ohne zu rechnen oder zu runden; Korrekturhinweise möglich.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/parse-freeform-offer/index.ts`_
- **Red-Team-Validierung Freitext-Angebot** · 🟠 regelmäßig  
  Vergleicht das geparste Programm-JSON mit einem bewusst anderen Modell (GPT-5) 1:1 gegen den Originaltext und meldet jede Abweichung als Finding — Absicherung gegen Parser-Fehler bei Preisen.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/validate-freeform-offer/index.ts`_
- **Angebots-Mail versenden** · 🔴 täglich  
  Versendet die Angebots-Mail mit Link zur öffentlichen Angebotsseite, optional mit LexOffice-PDF-Anhang (mit Warte-/Retry-Logik); mehrsprachig (de/en/it/fr), unterstützt Antwort-Modus mit Threading-Headern, eigene Betreffs, CC/BCC und Dry-Run-Vorschau.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-offer-email/index.ts`_
- **Verbindliche Auftragsbestätigung ohne Online-Zahlung** · 🟠 regelmäßig  
  Erfasst die verbindliche Annahme eines Angebots ohne Stripe-Zahlung (Zahlung vor Ort / nach Event / Überweisung) — online durch den Kunden auf der Angebotsseite oder offline durch den Admin (Telefon/E-Mail/vor Ort) mit interner Notiz, Gästezahl- und Betrags-Override; AGB-Version wird protokolliert.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/confirm-order/index.ts`_
- **Benachrichtigung bei Kundenreaktion auf Angebot** · 🔴 täglich  
  Informiert das Team per Mail, wenn ein Kunde auf der Angebotsseite reagiert (Auswahl/Notizen), sendet dem Kunden eine Buchungsbestätigung und erzeugt bei Zahlart 'Rechnung nach Event' automatisch die LexOffice-Rechnung.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/notify-customer-response/index.ts`_
- **Bestätigungskopie an Kunden** · 🟠 regelmäßig  
  Sendet dem Kunden eine Kopie seiner Angebotsreaktion (gewählte Option, Anmerkungen) als Bestätigung, mehrsprachig.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-customer-response-copy/index.ts`_
- **Automatische Angebots- und Restzahlungs-Erinnerungen** · 🟠 regelmäßig  
  Cron-Funktion: verschickt zweistufige Erinnerungen an Kunden mit offenem Angebot (2. Stufe mit Dringlichkeitshinweis) sowie Restzahlungs-Erinnerungen vor dem Event; mehrsprachig de/en/it/fr.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-scheduled-reminders/index.ts`_
- **Reparatur fehlerhafter LexOffice-Angebote** · 🟡 selten  
  Erstellt eine fehlerhaft berechnete LexOffice-Quotation (z.B. per_event-Preis fälschlich mit Gästezahl multipliziert) korrekt neu, storniert/löscht die alte und aktualisiert die Referenz am Event.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/repair-quotation-pricing/index.ts`_
- **Angebotsoptionen A/B/C (v2_offer_options)** · 🔴 täglich  
  Mehrere Angebotsvarianten pro Event mit Label, Paket (inkl. Namens-Snapshot), Angebotsmodus (à la carte / Teilmenü / Festmenü / Paket / E-Mail), Menüauswahl, Gästezahl, Betrag, Version, gewählt-Status und Stripe-Payment-Link; selected_quantity für Mengen-Optionen.  
  _Evidenz: `supabase/migrations/20260422202324, 20260421231025 (selected_quantity), 20260219_000003_update_offer_mode_values.sql`_
- **Versionierte Angebots-Historie (v2_event_offer_history)** · 🔴 täglich  
  Jeder Angebotsversand wird mit Version, Anschreiben-Text (Text + HTML), PDF-URL und vollständigen Snapshots (Optionen, Anfrage, Adressen, Zahlungsbedingungen) archiviert — Beleg, was der Kunde wann bekommen hat.  
  _Evidenz: `supabase/migrations/20260422202324, 20260701102834 (inquiry/address/payment_terms_snapshot)`_
- **Öffentliche Angebotsseite per Slug (Website-Berührungspunkt)** · 🔴 täglich  
  Kunde öffnet Angebot unter /ihr-angebot/:slug (hübscher Slug wie 'max-mustermann-a851'); anon-RPCs get_public_offer / get_public_offer_by_slug liefern Optionen, Anschreiben, Paketnamen und Zahlungslinks ohne Login.  
  _Evidenz: `supabase/migrations/20260207120000_public_offer_rpc.sql, 20260225_offer_slug_and_public_pdf.sql`_
- **Kunden-Antwort auf Angebot (submit_offer_response)** · 🔴 täglich  
  Kunde wählt auf der öffentlichen Seite eine Option und hinterlässt Anmerkungen (offer_customer_responses mit IP/User-Agent); offer_phase wechselt auf customer_responded — Workflow Vorschlag → Rückmeldung → finales Angebot.  
  _Evidenz: `supabase/migrations/20260218_000003_submit_offer_response_rpc.sql, 20260217230344`_
- **Angebots-Öffnungs-Tracking & Verlustgründe** · 🟠 regelmäßig  
  Anon-RPC track_offer_view zählt Aufrufe der Angebotsseite (first/last_viewed, view_count); bei Absage Pflicht-Dropdown loss_reason (zu teuer, Termin, keine Antwort, ...) — Grundlage für Conversion-Analyse im Admin.  
  _Evidenz: `supabase/migrations/20260624120000_conversion_tracking.sql`_
- **Offline-/Telefon-Annahme (confirm_offline_booking, _multi)** · 🟠 regelmäßig  
  Admin bestätigt Angebote für Zahlarten ohne Online-Zahlung (vor Ort / Rechnung), auch mit Mengen pro Option; order_confirmed_via/admin dokumentiert Annahme-Quelle (online/phone/email/onsite).  
  _Evidenz: `supabase/migrations/20260501200216, 20260502073259, 20260530171255`_
- **Mehrsprachige Angebote (DE/EN)** · 🟠 regelmäßig  
  customer_language, email_content_translations (JSONB) und last_translated_language auf v2_events ermöglichen übersetzte Anschreiben/Menütexte mit Sync-Banner im Editor.  
  _Evidenz: `supabase/migrations/20260514113605, 20260530194003, 20260530222040`_
- **Paketname pro Angebot überschreibbar** · 🟡 selten  
  Admin kann den angezeigten Paketnamen je Angebot via menu_selection.packageNameOverride überschreiben, ohne den Katalog zu ändern.  
  _Evidenz: `supabase/migrations/20260416_package_name_override.sql`_
- **Angebots-Versionshistorie (unveränderliches Archiv)** · 🔴 täglich  
  Jeder Versand archiviert einen vollständigen Snapshot: Optionen, Mail-Text und -HTML, PDF-URL, Kontakt-/Adress-/Zahlungsbedingungs-Snapshots. Empfänger/CC/BCC werden per Zeitmatching (±5 Min.) aus dem Mail-Log rekonstruiert.  
  _Evidenz: `src/hooks/useOfferHistory.ts`_
- **Alte Angebots-Version als Entwurf klonen** · 🟠 regelmäßig  
  Lädt eine archivierte Version zurück in den Editor: aktive Optionen werden deaktiviert, Snapshot-Optionen als neue Entwürfe eingefügt (Stripe-Links geleert), archivierte Adressen/Zahlungsbedingungen in die Live-Anfrage zurückgeschrieben.  
  _Evidenz: `src/hooks/useCloneOfferVersion.ts`_
- **KI-Angebotsentwurf aus Chat-Konversation** · 🟠 regelmäßig  
  Zeigt im Editor den KI-generierten Entwurf: vorgeschlagene Pakete/Positionen mit Preisen, Preisspanne, offene Fragen und das vom Kunden geäußerte Budget (aus mehreren Quellen zusammengeführt).  
  _Evidenz: `src/hooks/useAiDraft.ts`_
- **Kunden-Ansicht öffnen (Public-Offer-Vorschau)** · 🔴 täglich  
  Baut den Link zur öffentlichen Angebotsseite exakt so, wie der Kunde sie nach Versand sieht (Phase proposal/final, optional Anschreiben-Vorschau, Cache-Busting).  
  _Evidenz: `src/lib/adminPublicOfferUrl.ts`_
- **Kostenübernahme-Pflicht-Logik** · ⚙️ intern  
  Regelt automatisch, ob die digitale Kostenübernahme Pflicht ist: bei sofortiger Stripe-Anzahlung optional, sonst verbindlich erforderlich für den Vertragsschluss. Wird in Frontend und Edge Functions identisch genutzt.  
  _Evidenz: `src/lib/costAcceptanceRequirement.ts`_
- **MwSt-Berechnung 7%/19% aus Menü-Auswahl** · ⚙️ intern  
  Berechnet Brutto/Netto/Steuer automatisch: Speisen 7%, Getränke 19% (Pauschale, Weinbegleitung oder Einzelgetränke aus menu_selection), Catering per_event pauschal 7%; effektiver Mischsatz für die Anzeige.  
  _Evidenz: `src/lib/taxCalculation.ts`_
- **Angebots-Mehrsprachigkeit DE/EN/IT/FR** · 🟠 regelmäßig  
  Sprachauswahl fürs Angebot mit Fallback-Kette (gewünschte Sprache → EN → DE) für alle Snapshot-Felder.  
  _Evidenz: `src/lib/offerLang.ts`_
- **Live-Adress-Resolver für Angebot/Rechnung** · ⚙️ intern  
  Löst Veranstaltungsadresse (Storia / Firma / eigene Location) und Rechnungsadresse (abweichende Rechnungsanschrift) zur Laufzeit auf, inkl. Google-Maps-Link und mehrzeiliger PDF-Formatierung — kein Adress-Drift durch Snapshots.  
  _Evidenz: `src/lib/addressResolver.ts`_

## E-Mail (25)

- **Mail-Client pro Anfrage** · 🔴 täglich  
  Posteingang je Vorgang mit Thread-Sidebar und Reading-Pane (HTML in sandboxed iframe), ein-/ausgehend markiert, Anhänge; Antworten mit Rich-Text-Editor (fett/kursiv/Listen), CC/BCC — Versand über send-offer-email als Reply.  
  _Evidenz: `src/components/admin/shared/MailClient.tsx, MailComposer.tsx, ConversationThread.tsx`_
- **Mail-Zuordnung zu Events** · 🟠 regelmäßig  
  Tab 'Mails zuordnen': automatische Zuordnungs-Filter pro Event anlegen/entfernen (Von-Adresse, Betreff-enthält, mit Label), Mail vom Event entfernen (mit Grund), wiederherstellen, global archivieren/entarchivieren, .eml-Download, Anhänge herunterladen.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/EventMailsTab.tsx`_
- **Posteingang mit Entwürfen (Drafts-View)** · 🔴 täglich  
  Server-seitige E-Mail-Entwürfe durchsuchen (Kundenname, Eventnummer, Anlass), in Maestro weiterschreiben und löschen; separater Zähler für unzugeordnete Mails in der Navigation.  
  _Evidenz: `src/components/admin/posteingang/DraftsView.tsx, AdminLayout.tsx (useUnassignedInbox)`_
- **Zustellstatus & Fehlerdiagnose** · 🔴 täglich  
  Pro Vorgang: Versandhistorie mit Resend-Status und Message-ID; Banner übersetzt englische Provider-Fehler (Resend/SES/SMTP) in verständliches Deutsch; Zustellfehler erscheinen in Liste, Kanban und Dashboard.  
  _Evidenz: `src/components/admin/shared/EmailStatusCard.tsx, src/components/admin/refine/InquiryEditor/EmailFailureBanner.tsx`_
- **Zentrale Mail-Inbox mit IMAP-Sync (inbox_emails)** · 🔴 täglich  
  Vollständige Kopie des Postfachs (Raw-MIME, Absender, Empfänger, Betreff, Body, Thread-Header) inkl. Anhang-Extraktion (email_attachments) und Sync-Status pro IMAP-Ordner (imap_sync_state); Mails können ausgeblendet werden.  
  _Evidenz: `supabase/migrations/20260509220212_969d3864-3c4a-463a-8024-80a5328d3f93.sql`_
- **Mail-zu-Event-Zuordnung (event_email_filters, event_email_links)** · 🔴 täglich  
  Regeln (Absender, Betreff-Contains, Thread-Root) verknüpfen eingehende Mails automatisch mit Events; manuelle Zuordnung und Ausschluss (is_excluded) möglich; View unassigned_inbox_emails zeigt den unzugeordneten Eingang.  
  _Evidenz: `supabase/migrations/20260509220212, 20260509234950 (View)`_
- **Absender-Blockliste & KI-Klassifikations-Feedback** · 🟠 regelmäßig  
  email_sender_blocklist filtert Spam-Absender aus der Inbox; email_classification_feedback speichert KI-Vorschlag vs. tatsächliche Zuordnung (was_correct generiert) — lernende Mail-Klassifikation.  
  _Evidenz: `supabase/migrations/20260509224238, 20260509233514`_
- **Mail-Verlauf pro Event (v2_event_emails)** · 🔴 täglich  
  Ein-/ausgehende E-Mails je Event mit Betreff, Text/HTML, Anhängen, Resend-Message-ID und Zustellstatus — Kommunikations-Timeline in der Event-Akte (RPC get_event_emails, is_read-Kennzeichnung).  
  _Evidenz: `supabase/migrations/20260403010000_email_messages.sql, 20260422202324, 20260219_000001_fix_public_offer_rpc_and_is_read.sql`_
- **E-Mail-Vorlagen, Textbausteine & Signatur (email_templates)** · 🔴 täglich  
  Vorlagen mit Betreff, Body, Kategorie (vorlage/textbaustein/signatur), Variablen ({{kundenname}}, {{eventdatum}}, ...) und Sortierung; ausgeliefert mit 6 STORIA-Formaten (Network-Aperitivo, Business Dinner, ...) und zentraler Firmen-Signatur.  
  _Evidenz: `supabase/migrations/20260203140000_email_templates.sql, 20260219_000002_storia_email_templates_and_snippets.sql, 20260221_000001_email_signature.sql`_
- **Zustell-Tracking & Fehler-Alarm (email_delivery_logs)** · ⚙️ intern  
  Jeder Mailversand (IONOS SMTP / Resend) wird geloggt; Resend-Webhooks aktualisieren den Status, ein Trigger ruft bei Fehlschlägen die Edge Function notify-email-failure auf (Alarm ans Team, idempotent).  
  _Evidenz: `supabase/migrations/20260130230909, 20260225_resend_webhook_tracking.sql, 20260613211739`_
- **Automatische Angebots-Nachfassmails** · 🟠 regelmäßig  
  reminder_count/reminder_sent_at auf Events steuern gestaffelte Erinnerungen (Tag 3 / Tag 7) nach Angebotsversand an Kunden, die nicht reagieren.  
  _Evidenz: `supabase/migrations/20260203150000_reminder_tracking.sql`_
- **Automatische Google-Bewertungsanfragen (review_request_*)** · 🟠 regelmäßig  
  Nach Events/Bestellungen werden zeitversetzt (X Werktage) Bewertungs-Mails mit Google-Review-Link verschickt; Einstellungen (Scope Events/Orders, BCC), Versand-Log mit Skip-Gründen und Abmelde-Liste (Unsubscribe-Link im Footer).  
  _Evidenz: `supabase/migrations/20260624140217_75619b97-2bbb-4f7d-a7e2-18c2b0c56684.sql`_
- **Unzugeordneter Posteingang mit KI-Zuordnungsvorschlägen** · 🔴 täglich  
  Zeigt eingehende IMAP-Mails ohne Event-Zuordnung inkl. KI-Vorschlag (passendes Event / neue Anfrage / irrelevant / unklar) mit Konfidenz und Begründung; Realtime-Aktualisierung und Zähler-Badge (30s-Polling).  
  _Evidenz: `src/hooks/useUnassignedInbox.ts`_
- **Ausgeblendete Mails & Absender-Blockliste** · 🟠 regelmäßig  
  Separate Ansicht für ausgeblendete Posteingangs-Mails (mit Grund) und Verwaltung einer Absender-Blockliste.  
  _Evidenz: `src/hooks/useUnassignedInbox.ts (useHiddenInbox, useBlocklist)`_
- **IMAP-Entwurfsordner im Backoffice** · 🟠 regelmäßig  
  Zeigt E-Mail-Entwürfe (direction=draft) aus dem IMAP-Postfach mit Empfängern, CC, Betreff — Realtime-Sync bei Änderungen.  
  _Evidenz: `src/hooks/useUnassignedInbox.ts (useDraftsInbox)`_
- **Mail-Verlauf je Anfrage inkl. Formular-Rückmeldungen** · 🔴 täglich  
  Chronologischer Thread aller ein-/ausgehenden Mails einer Anfrage; Kundenreaktionen auf das Online-Angebot (gewählte Option + Anmerkung) werden als gestylte Pseudo-Mail eingebettet. Realtime-Nachladen bei neuen Mails/Antworten.  
  _Evidenz: `src/hooks/useMailThread.ts`_
- **Event-Mail-Zuordnung über Filterregeln** · 🔴 täglich  
  Pro Event können Mail-Filter (Absender, Betreff-enthält, Thread-Wurzel) aktiviert werden, die Posteingangs-Mails automatisch dem Event zuordnen; Mails via RPC get_event_emails inkl. Ausblenden/Ausschließen, Realtime-Sync.  
  _Evidenz: `src/hooks/useEventEmails.ts`_
- **Zustellprotokoll pro Vorgang** · 🔴 täglich  
  Zeigt je Anfrage/Buchung alle versendeten Mails mit Provider (IONOS SMTP / Resend) und Status-Tracking: versandt, zugestellt, geöffnet, abgewiesen, Spam-Meldung, verzögert, fehlgeschlagen.  
  _Evidenz: `src/hooks/useEmailDeliveryLogs.ts`_
- **Zustellfehler-Management mit Erledigt-Markierung** · 🟠 regelmäßig  
  Globale Liste unerledigter Zustellfehler (30 Tage, Realtime), Fehler als erledigt markierbar mit automatischem Aktivitätslog-Eintrag; WhatsApp-Team-Alerts werden bewusst ausgenommen.  
  _Evidenz: `src/hooks/useEmailFailures.ts`_
- **Betreiber-Adressen-Schutz beim Angebotsversand** · ⚙️ intern  
  Verhindert versehentlichen Versand von Angeboten an eigene Adressen (info@events-storia.de etc.): UI blockt mit Bestätigungsdialog, Edge Function verlangt explizites Override-Flag.  
  _Evidenz: `src/lib/operatorEmailGuard.ts`_
- **E-Mail-Vorlagen mit bedingter Logik** · 🔴 täglich  
  Drei STORIA-Vorlagen (Gruppenreservierung, Business-Aperitivo, Exklusive Location) mit dynamischem Eventdetails-Satz, Tafelhinweis abhängig von der Gästezahl (1/2/mehrere Tafeln) und Checkliste nur für fehlende Angaben.  
  _Evidenz: `src/lib/emailTemplates.ts`_
- **Universeller Template-Renderer ({{Variablen}})** · 🔴 täglich  
  Rendert beliebige DB-Vorlagen: einfache Variablen (kundenname, eventdatum), zusammengesetzte Blöcke (eventdetails_satz, signatur, checkliste) und Angebots-Variablen (optionen, menu, getraenke, preis_pro_person); Cleanup nicht ersetzter Platzhalter.  
  _Evidenz: `src/lib/emailTemplateRenderer.ts`_
- **CC/BCC beim Mailversand** · 🟠 regelmäßig  
  Der Mail-Composer im Backoffice erlaubt einblendbare CC- und BCC-Felder fuer ausgehende Mails an Kunden.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/shared/MailComposer.tsx (Z. 26, 56-142)`_
- **Anhaenge eingehender Mails anzeigen und herunterladen** · 🟠 regelmäßig  
  Eingehende Kundenmails zeigen einen Anhang-Zaehler; Anhaenge werden aus der Tabelle email_attachments geladen und aus dem Storage-Bucket 'email-attachments' heruntergeladen.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/EventMailsTab.tsx (Z. 372-408, 545-548, 634 ff.), Migrationstabelle email_attachments`_
- **Persoenliche Absender-Signaturen je Teammitglied** · 🟠 regelmäßig  
  Ausgehende Mails werden je nach angemeldetem Absender automatisch mit Vorname und Mobilnummer des Mitarbeiters personalisiert (fest hinterlegtes SENDER_INFO-Mapping plus Firmen-Signatur aus der DB).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/generate-inquiry-email/index.ts (Z. 9-16, loadCompanyFooter)`_

## Einstellungen (19)

- **Unternehmensdaten (NAP)** · 🟡 selten  
  Zentrale Pflege von Firmenname, rechtlichem Namen, Adresse, Telefon, E-Mail, Website, USt-IdNr. und Handelsregister-Nr. (wird u.a. fuer Belege/Website genutzt).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/Settings.tsx (Tab Stammdaten, Route /admin/settings)`_
- **Benachrichtigungen & Google-Bewertungsanfragen** · 🟡 selten  
  E-Mail-Benachrichtigungen ein-/ausschalten mit Zieladresse; automatisierte Google-Review-Anfragen nach Events/Bestellungen konfigurieren (aktiv, Verzoegerung in Werktagen, Review-URL, BCC, Geltungsbereich, Testversand/Dry-Run, letzte Laufstatistik).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/Settings.tsx, ReviewRequestsCard.tsx`_
- **E-Mail-Vorlagen, Textbausteine & Signatur** · 🟠 regelmäßig  
  Vorlagen-Tab: E-Mail-Vorlagen anlegen/bearbeiten/loeschen/aktivieren, wiederverwendbare Textbausteine und die E-Mail-Signatur pflegen (werden im Angebots-Composer genutzt).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/Settings.tsx (EmailTemplates/Textbausteine/E-Mail-Signatur)`_
- **Team-Verwaltung** · 🟡 selten  
  Teammitglieder per E-Mail einladen, Rollen aendern (admin/staff), Nutzer aktivieren/deaktivieren.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/Settings.tsx (Team verwalten, handleInvite/handleRoleChange)`_
- **Leihequipment-Katalog** · 🟡 selten  
  Katalog von Leihequipment-Positionen (Name, Standardmenge, Stueckpreis, Einheit) mit CSV/TSV/TXT-Import fuer die Verwendung in Angeboten.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/EquipmentCatalogCard.tsx`_
- **Eigenes Konto** · 🟡 selten  
  Anzeigename aendern, Passwort aendern, Erscheinungsbild; Schnellaktionen und Verweise auf Speisen-/Pakete-Verwaltung aus den Settings-Tabs.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/Settings.tsx (Tab Mein Konto)`_
- **Unternehmensdaten & Benachrichtigungen** · 🟡 selten  
  Firmen-Stammdaten (Name, Adresse, Kontakt) zentral pflegen; E-Mail-Benachrichtigungen bei neuen Anfragen/Bestellungen aktivieren und Empfängeradresse festlegen; Änderungen speichern automatisch.  
  _Evidenz: `src/components/admin/refine/Settings.tsx (Tabs stammdaten, Benachrichtigungen)`_
- **Team- & Rollenverwaltung** · 🟡 selten  
  Nutzer per E-Mail einladen (Rolle Team oder Admin), Rolle per Klick wechseln, Nutzer aktivieren/deaktivieren (nur Admin); eigenes Konto: Name/E-Mail ändern, Passwort ändern, Erscheinungsbild.  
  _Evidenz: `src/components/admin/refine/Settings.tsx (UserManagement), src/components/admin/shared/UserProfileDropdown.tsx`_
- **Google-Bewertungsanfragen automatisieren** · 🟡 selten  
  Automatischer Versand von Bewertungs-Mails X Werktage nach Event/Bestellung: An/Aus, Google-Review-URL, BCC, Scope (Events/Bestellungen), Testmail an eigene Adresse, Dry-Run, Statistiken des letzten Laufs und der letzten 7 Tage.  
  _Evidenz: `src/components/admin/refine/ReviewRequestsCard.tsx`_
- **Geschäftsdaten & Zahlungsbedingungen (site_settings)** · 🟡 selten  
  Zentraler Key-Value-Store: business_data (Firmenname, NAP, USt-ID, HRB, Benachrichtigungs-Mail, MwSt-Satz) und default_payment_terms — einzige Quelle für Firmendaten in Angeboten/Mails (ersetzt localStorage).  
  _Evidenz: `supabase/migrations/20260222_site_settings.sql, 20260224212433`_
- **CRM-Konfiguration (crm_settings)** · 🟡 selten  
  Key-Value-Store für CRM-Einstellungen (z.B. Kostenübernahme-/eSignatures-Konfiguration); Admin schreibt, Staff liest.  
  _Evidenz: `supabase/migrations/20260613194611`_
- **Rollen & Rechte (user_roles, admin/staff)** · ⚙️ intern  
  Zwei Rollen (admin, staff) mit has_role()-Prüfung in praktisch allen RLS-Policies; separate Staff-Policies (z.B. Templates nutzen, Events bearbeiten) seit 20260222.  
  _Evidenz: `supabase/migrations/20251205174913, 20260222_staff_role_policies.sql`_
- **Multi-Mandanten-Fundament (tenants, tenant_users)** · ⚙️ intern  
  Mandanten mit Branding (Logo, Farbe, From-Name/E-Mail), Stripe-Account und Lexoffice-Key-Referenz; tenant_id-Spalte auf nahezu allen Tabellen, JWT-Hook custom_access_token_hook und tenant-scoped RLS — Produktisierung des Backoffice ('StoriaMaestro').  
  _Evidenz: `supabase/migrations/20260625231516 ff., 20260626081602, 20260626140035`_
- **Admin-Login mit Rollenprüfung (admin/staff)** · 🔴 täglich  
  Anmeldung nur für Konten mit Rolle in user_roles; Rolle wird mit 8s-Timeout geprüft und in sessionStorage gecached; Konten ohne Berechtigung werden sofort wieder abgemeldet. Client-Hook liefert isAdmin für UI-Rechte (Admin vs. Staff).  
  _Evidenz: `src/hooks/useAdminAuth.ts, src/lib/adminAuth.ts, src/hooks/usePermissions.ts`_
- **Privacy-Modus (Zahlen unkenntlich machen)** · 🟠 regelmäßig  
  Globaler Schalter, der sensible Werte (Geldbeträge, Kundendaten) per CSS verwischt — z.B. wenn Kunden/Gäste auf den Bildschirm schauen; Tastenkürzel Cmd/Ctrl+Shift+P, Einstellung bleibt gespeichert.  
  _Evidenz: `src/contexts/PrivacyModeContext.tsx`_
- **Mitarbeiter-Namensregister** · ⚙️ intern  
  Zentrale Zuordnung E-Mail → Anzeigename, Initialen und Mobilnummer für Timeline, Signaturen und Avatare; Fallback-Ableitung aus der E-Mail-Adresse.  
  _Evidenz: `src/lib/adminDisplayNames.ts`_
- **System-Health-Fehlerreporting** · ⚙️ intern  
  Frontend-Fehler werden automatisch per RPC (report_frontend_error) an den Maestro-System-Health-Hub gemeldet, inkl. URL und User-Agent — schlägt selbst nie fehl.  
  _Evidenz: `src/lib/reportError.ts`_
- **Anzeigenamen-Bereinigung (Platzhalter-Filter)** · ⚙️ intern  
  Zentraler Helper, der Platzhalter-Strings ('null', 'n/a', '-') in Firmen-/Kontaktnamen herausfiltert und B2C-Kunden korrekt erkennt — verhindert 'Hallo null'-Bugs in Mails und Karten.  
  _Evidenz: `src/lib/displayName.ts`_
- **Haptisches Feedback auf Touch-Geräten** · ⚙️ intern  
  Vibrationsmuster (tick/select/success/warning/error) bei bestätigenden Aktionen; respektiert prefers-reduced-motion.  
  _Evidenz: `src/lib/haptics.ts`_

## Angebot (Editor) (17)

- **Tab-basierter Anfrage-Editor** · 🔴 täglich  
  Zentrale Bearbeitungsansicht pro Anfrage mit Tabs Angebot / Nachrichten / Aufgaben / Details / Aktivitäten; Auto-Save mit 1,2s-Debounce, Snapshot-Vergleich und Fehler-Retry-Stopp.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx`_
- **Bis zu 5 Angebots-Optionen (A–E) mit 5 Modi** · 🔴 täglich  
  Pro Option unabhängiger Modus: Restaurant-Menü laden, Eigenes Menü, Paket, Freitext-Import (KI) oder Nur-E-Mail; Optionen duplizieren, ein-/ausblenden, zurücksetzen, löschen; Kachel-Auswahl beim Start.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx, OptionCard.tsx, ModeSelector.tsx`_
- **Menü-Editor mit Gängen und Mehrtages-Support** · 🔴 täglich  
  Gänge hinzufügen/umbenennen/verschieben/entfernen, Gerichtsuche im kombinierten Katalog (Catering + Ristorante) oder Freitext-Gericht, Menge, Preis-Override; mehrtägige Menüs über Tages-Tabs (Tag hinzufügen, umbenennen z.B. 'Mo 29.06. Lunch', entfernen); mobiles Bottom-Sheet zur Gang-Bearbeitung.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineCourseEditor.tsx, DishPicker.tsx, DayTabsBar.tsx, MobileCourseSheet.tsx, menuDaysHelpers.ts`_
- **Getränke-Konfiguration mit 4 Modi** · 🔴 täglich  
  Pro Option Getränke als: Keine, Pauschale (Beschreibung + Preis/Person), Einzelpositionen (mit Menge und Preis) oder Weinbegleitung; bei Paketen automatische Vorbelegung aus der Paket-Getränkekonfiguration.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/DrinkSection.tsx, InlineDrinkEditor.tsx`_
- **Equipment & Personal pro Option** · 🟠 regelmäßig  
  Zusatzleistungen (Chafing Dish, Geschirr, Kellner, Barkeeper …) aus dem Equipment-Katalog suchen oder frei erfassen, mit Menge und Preis; fließen in den Gesamtpreis ein und werden bei KI-Varianten konsistent gespiegelt.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/InlineServiceEditor.tsx`_
- **Preislogik: pro Person/pauschal, Rabatt, Override** · 🔴 täglich  
  Globaler Preismodus pro Option und Zeilen-Toggle '/Pers. vs. pauschal' je Speise/Getränk; Rabatt als Prozent oder Betrag; Paketpreis-Override; Live-Preisaufschlüsselung mit MwSt-Ausweis (7% Speisen / 19% Leistungen) inkl. Equipment/Personal.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/LinePriceModeToggle.tsx, PriceBreakdown.tsx, useOfferBuilder.ts`_
- **Restaurant-Menü-Import** · 🔴 täglich  
  Degustations-/Restaurant-Menüs aus dem Ristorante-Katalog per Sheet auswählen und als Option(en) importieren; automatische Gang-Typ-Erkennung per Heuristik; optional Getränkepauschale/Weinbegleitung direkt ergänzen; Mehrfach-Import legt mehrere Optionen an.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/MenuImporter.tsx`_
- **Freitext-Import mit KI-Parsing** · 🟠 regelmäßig  
  Freitext (z.B. aus alter Word-/Mail-Vorlage) wird per Edge Function in ein strukturiertes Programm geparst: Tage → Mahlzeiten → Sektionen → Positionen (Menge × Einzelpreis netto), Zusatzleistungen, Leistungsumfang, Steueraufteilung, Rabatt; danach voll editierbar inkl. Auto-Kalkulation und Validierungs-Findings.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/FreeformImportPanel.tsx, FreeformProgramEditor.tsx, freeformToMenuDays.ts`_
- **KI-Menüvorschlag (3 Preisvarianten)** · 🟠 regelmäßig  
  Ein Klick erzeugt per Edge Function drei Menü-Varianten (Low/Medium/High) mit Begründung, die automatisch in freie Optionen A–E gelegt werden; Equipment/Personal werden aus bestehenden Optionen übernommen.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/OfferBuilder.tsx (generate-menu-suggestion)`_
- **Anfrage-Kontext-Banner mit 1-Klick-Paketübernahme** · 🔴 täglich  
  Zeigt Quelle, angefragtes Paket und Originalnachricht des Kunden über dem Optionen-Grid; angefragtes Paket per Klick in Option A übernehmen.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/RequestContextBanner.tsx`_
- **KI-Kundenentwurf übernehmen** · 🟠 regelmäßig  
  Wenn der Kunde über die Website-KI-Bar angefragt hat, zeigt eine Karte den KI-Entwurf; Übernahme mappt ihn (rein lokal, ohne DB-Write) auf eine Angebots-Option inkl. Warnungen/übersprungener Items; Option wird als 'KI-Entwurf — prüfen' markiert; vollständiger KI-Chatverlauf einsehbar.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/AiDraftCard.tsx, OfferBuilder/aiDraftToOption.ts, AiConversationSheet.tsx`_
- **Anschreiben-Composer mit Vorlagen, Bausteinen und KI** · 🔴 täglich  
  E-Mail-Anschreiben mit DB-Vorlagen (ersetzen den Text), Textbausteinen (werden angehängt), klickbaren Variablen ({{name}}, {{datum}} …) und KI-Generierung passend zur Angebotsphase (Proposal/Final); vor der KI-Generierung wird der aktuelle Angebotsstand geflusht.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/EmailComposer.tsx, OfferBuilder.tsx (generate-inquiry-email)`_
- **Zahlungskonditionen pro Anfrage** · 🔴 täglich  
  Anzahlung (Prozent oder Betrag), Anzahlungsfrist, Restzahlungsfrist vor Event, Zahlungsfrist nach Event, Angebotsgültigkeit, Zahlungswege getrennt für Anzahlung und Restzahlung (z.B. Stripe vs. vor Ort).  
  _Evidenz: `src/components/admin/refine/InquiryEditor/PaymentTermsBlock.tsx`_
- **Angebots-Option duplizieren** · 🟠 regelmäßig  
  Eine bestehende Angebots-Option kann per Klick als Kopie angelegt werden (bis zum Maximum von 5 Optionen), statt sie manuell neu aufzubauen.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx (Z. 420-423), /home/user/events-storia.de/src/components/admin/refine/InquiryEdito`_
- **KI-Entwurf-Vergleichsansicht (Diff-Panel)** · 🟡 selten  
  Zeigt die Unterschiede zwischen dem KI-generierten Angebotsentwurf und dem aktuellen Angebot, bevor der Entwurf uebernommen wird.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/DraftDiffPanel.tsx`_
- **KI-Chat-Verlauf der Anfrage einsehen** · 🟠 regelmäßig  
  Bei Anfragen, die ueber den KI-Chat der Website entstanden sind, kann das Team die komplette Original-Konversation des Kunden in einem Sheet nachlesen.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/AiConversationSheet.tsx`_
- **Adress-Autovervollstaendigung (OpenStreetMap/Nominatim)** · 🟠 regelmäßig  
  Beim Erfassen von Event-/Liefer-/Rechnungsadressen schlaegt ein Nominatim-Autocomplete vollstaendige Adressen vor und fuellt die Strukturfelder.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/NominatimAutocomplete.tsx`_

## E-Mail (Posteingang) (15)

- **IMAP-Postfach-Synchronisation** · 🔴 täglich  
  Synchronisiert das IONOS-Postfach info@events-storia.de (INBOX inkl. Unterordner, Gesendet, Entwürfe) inkrementell in die Maestro-Inbox; Reconciliation alle 10 Min. erkennt verschobene/gelöschte Mails, Anhänge landen im Storage, eigene Outbound-Kopien werden dedupliziert. Stößt automatisch Filter-Matching und KI-Zuordnungsvorschläge an.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/imap-sync/index.ts`_
- **Automatisches Mail-zu-Event-Matching** · 🔴 täglich  
  Prüft jede neue Mail gegen alle aktiven Event-Mail-Filter (Absender, Betreff, Thread) und verlinkt sie automatisch mit dem passenden Event, ohne manuelle Ausschlüsse zu überschreiben.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/match-email-to-events/index.ts`_
- **KI-Zuordnungsvorschläge für Mails** · 🔴 täglich  
  Zweistufige Klassifikation eingehender Mails: erst deterministische Heuristiken (Thread, Kunde, Datum, Gäste, Spam-Muster), dann Claude Haiku. Ergebnis: Vorschlag match/neue Anfrage/irrelevant/unklar mit Konfidenz und Begründung.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/suggest-email-mapping/index.ts`_
- **Bulk-Nachverarbeitung Zuordnungsvorschläge** · 🟡 selten  
  Erzeugt für alle noch unbewerteten, freischwebenden Mails nachträglich KI-Zuordnungsvorschläge (max. 50 pro Lauf).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/bulk-suggest-mappings/index.ts`_
- **Mail manuell einem Event zuordnen** · 🔴 täglich  
  Ordnet eine Inbox-Mail einem Event zu — entweder nur diese Mail oder mit Auto-Filter auf den Absender inkl. Backfill aller Bestandsmails. Warnt, wenn derselbe Kunde mehrere offene Events hat (Multi-Inquiry-Check).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/assign-inbox-email-to-event/index.ts`_
- **Event-Mail-Filter anlegen** · 🟠 regelmäßig  
  Legt eine Filterregel (Absender, Betreff enthält, Thread-Wurzel) für ein Event an und verlinkt rückwirkend alle passenden Bestandsmails (symmetrisch für ein- und ausgehende Mails).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/add-event-email-filter/index.ts`_
- **Event-Mail-Filter entfernen** · 🟡 selten  
  Soft-Delete eines Filters und Aufräumen der Mail-Verknüpfungen, sofern keine andere aktive Regel die Mail noch mit dem Event verbindet.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/remove-event-email-filter/index.ts`_
- **Einzelne Mail vom Event lösen** · 🟠 regelmäßig  
  Schließt eine einzelne Mail von einem Event aus (mit Grund), ohne den Filter zu löschen.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/remove-email-from-event/index.ts`_
- **Ausgeschlossene Mail wieder zuordnen** · 🟡 selten  
  Hebt den Ausschluss einer Mail von einem Event wieder auf.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/restore-email-to-event/index.ts`_
- **Mail global archivieren / wiederherstellen** · 🟠 regelmäßig  
  Blendet eine Mail postfachweit aus (mit Grund, Zeitstempel, Nutzer) bzw. macht das rückgängig.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/archive-email-globally/index.ts, /home/user/events-storia.de/supabase/functions/unarchive-email-globally/index.ts`_
- **Mail ignorieren / Ignorieren aufheben** · 🟠 regelmäßig  
  Markiert eine Inbox-Mail als irrelevant (Spam/kein Bezug) bzw. stellt sie wieder her.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/ignore-inbox-email/index.ts, /home/user/events-storia.de/supabase/functions/restore-ignored-email/index.ts`_
- **Anfrage aus Inbox-Mail erstellen** · 🟠 regelmäßig  
  Legt direkt aus einer eingegangenen Mail einen neuen Kunden (falls nötig) und eine neue Event-Anfrage an und verlinkt die Mail.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-inquiry-from-inbox-email/index.ts`_
- **E-Mail-Entwurf auf Server löschen** · 🟡 selten  
  Löscht einen Entwurf auch auf dem IONOS-Mailserver (IMAP EXPUNGE) und markiert den DB-Eintrag als serverseitig gelöscht.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/delete-imap-draft/index.ts`_
- **Weiterleitungs-Webhook (maestro@-Adresse)** · 🟠 regelmäßig  
  Nimmt weitergeleitete Mails per Webhook entgegen (Secret-geschützt) und legt daraus automatisch Kunde + neue Anfrage im Status inquiry an.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/inbound-maestro-email/index.ts`_
- **Antwort-Mails automatisch zuordnen (Resend Inbound)** · 🔴 täglich  
  Empfängt Kundenantworten via Resend-Inbound-Webhook und ordnet sie über reply+{uuid}@-Adresse oder In-Reply-To-Header der richtigen Anfrage zu, sodass sie im Konversationsverlauf erscheinen.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/receive-inbound-email/index.ts`_

## Navigation/Shell (14)

- **Admin-Login mit Passwort-Reset** · 🔴 täglich  
  Anmeldung mit E-Mail/Passwort (Zod-Validierung), Dialog zum Zuruecksetzen des Passworts. Nach Login Weiterleitung ins Dashboard.  
  _Evidenz: `/home/user/events-storia.de/src/pages/AdminLogin.tsx, /home/user/events-storia.de/src/App.tsx (Route /admin/login)`_
- **Sidebar-Navigation mit Live-Badges** · 🔴 täglich  
  Feste Seitenleiste mit 11 Punkten: Dashboard, Anfragen, Bestellungen, Posteingang, Angebote, Rechnungen, Auswertung, Gutscheine, Fotoalbum, System-Health, Einstellungen. Badges zeigen offene Zaehler (neue Anfragen + offene Buchungen, offene Bestellungen, nicht zugeordnete Mails).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/AdminLayout.tsx (navigation[])`_
- **Globale Suche / Command-Palette** · 🔴 täglich  
  Suchfeld im Header oeffnet Command-Palette (Cmd+K): Volltextsuche ueber Event-Anfragen und Catering-Bestellungen, Navigations-Shortcuts, Schnellaktionen und externe Links (Website).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/CommandPalette.tsx`_
- **Benachrichtigungs-Center** · 🔴 täglich  
  Glocken-Icon im Header mit Liste ungelesener Benachrichtigungen; Klick markiert als gelesen und springt zum verknuepften Vorgang.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/shared/NotificationCenter.tsx`_
- **Testdaten-Modus** · 🟠 regelmäßig  
  Header-Toggle blendet Testdaten (is_test) in allen Listen ein/aus; Anfragen koennen per Bulk-Aktion als Test/Echt markiert werden.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/AdminLayout.tsx, /home/user/events-storia.de/src/contexts/TestModeContext (Import)`_
- **Privacy-Modus fuer Demos** · 🟡 selten  
  Toggle (auch Cmd+Shift+P) blurrt Umsatzzahlen und Kundendaten fuer Praesentationen/Demos.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/AdminLayout.tsx (togglePrivacyMode), PrivacyBlur.tsx`_
- **Auto-Save-Statusanzeige & Rollen** · ⚙️ intern  
  SaveStatusBadge zeigt Speicherstatus der Editoren; Nutzerprofil mit Rolle (Administrator/Team) und Logout. Rollenmodell admin/staff via usePermissions.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/shared/SaveStatusBadge.tsx, /home/user/events-storia.de/src/hooks/usePermissions.ts`_
- **Sidebar-Navigation mit Live-Zählern** · 🔴 täglich  
  Hauptnavigation (Dashboard, Anfragen, Bestellungen, Posteingang, Angebote, Rechnungen, Auswertung, Gutscheine, Fotoalbum, System-Health, Einstellungen) mit Live-Badges für neue Anfragen, offene Bestellungen, offene Buchungen und unzugeordnete Mails; mobile Varianten (Bottom-Nav, Pill-Nav).  
  _Evidenz: `src/components/admin/refine/AdminLayout.tsx, src/components/admin/refine/FloatingPillNav.tsx`_
- **Globale Suche / Command-Palette** · 🔴 täglich  
  ⌘K-Palette mit Live-Suche über Event-Anfragen (Name/Firma/E-Mail) und Catering-Bestellungen (Name/Firma/Bestellnummer), Navigations-Shortcuts (⌘D/⌘E/⌘O/⌘P/⌘M) und Schnellaktionen (Neue Anfrage, Neues Paket).  
  _Evidenz: `src/components/admin/refine/CommandPalette.tsx`_
- **Privacy-Modus für Demos** · 🟡 selten  
  Umschalter (⌘⇧P), der alle Geldbeträge und Kundendaten global blurrt (body[data-privacy]); für Vorführungen des Systems ohne Datenpreisgabe.  
  _Evidenz: `src/components/admin/refine/AdminLayout.tsx, src/components/admin/PrivacyBlur.tsx`_
- **Testdaten-Umschalter** · 🟠 regelmäßig  
  Toggle 'Testdaten anzeigen' blendet als Test markierte Anfragen/Bestellungen ein/aus; Bulk-Aktion erlaubt Markieren als Test/Echt.  
  _Evidenz: `src/components/admin/refine/AdminLayout.tsx, src/components/admin/shared/BulkActionBar.tsx`_
- **Benachrichtigungszentrale** · 🔴 täglich  
  Glocken-Popover mit Benachrichtigungen (neue Anfrage, Anfrage zugewiesen, Kommentar hinzugefügt u.a.), als gelesen markieren und Deep-Link zur jeweiligen Anfrage.  
  _Evidenz: `src/components/admin/shared/NotificationCenter.tsx`_
- **Zentraler Auto-Save-Status** · 🔴 täglich  
  Save-Status-Badge im Header zeigt Speichern/Gespeichert/Fehler aller registrierten Editoren; flushAll() erzwingt Speichern vor Druck/Navigation.  
  _Evidenz: `src/components/admin/shared/SaveStatusBadge.tsx, SaveStatusContext.tsx`_
- **Deep-Links in Resend- und Stripe-Dashboards** · 🟠 regelmäßig  
  Aktivitaeten, Karten und Tabellen zeigen kompakte Icon-Links, die eine Mail direkt in Resend bzw. eine Zahlung/Session/Charge direkt im Stripe-Dashboard oeffnen.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/shared/ExternalRefLinks.tsx`_

## Angebot (Anfrage-Editor) (14)

- **Angebots-Builder mit Optionen** · 🔴 täglich  
  Herzstueck: mehrere Angebots-Optionen (A/B/C) je Anfrage, Menue nach Tagen und Gaengen (DayTabs), Speisen aus Katalog per DishPicker, Getraenke-Sektion, Inline-Editoren fuer Gaenge/Getraenke/Services, Freitext-Programm-Editor, Menue-Import aus Text, Preisaufschluesselung mit Rabatt und Pro-Kopf/Pauschal-Preismodus. Auto-Save.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/OfferBuilder/ (OfferBuilder.tsx, OptionCardGrid.tsx, DishPicker.tsx, FreeformProgramEditor.tsx, PriceBreakdown`_
- **KI-Anschreiben & KI-Menuevorschlag** · 🔴 täglich  
  E-Mail-Anschreiben per Edge-Function generieren lassen (arbeitet mit aktuellem Angebotsstand); fuer Catering-Anfragen KI-Menuevorschlag auf Knopfdruck. KI-Entwurf aus Kundenmail (AiDraftCard) kann als Angebots-Option uebernommen werden.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/OfferBuilder/EmailComposer.tsx, aiDraftToOption.ts, AiDraftCard.tsx, SmartInquiryEditor.tsx (handleGenerateCat`_
- **Versand mit WYSIWYG-Vorschau** · 🔴 täglich  
  Vor dem Senden strikt read-only Vorschau (Dry-Run der Edge-Function send-offer-email): exakte E-Mail (Absender, Empfaenger, Betreff, HTML), oeffentliche Angebotsseite und LexOffice-PDF. Unterscheidung Proposal-Versand vs. finales Angebot; Bestaetigungsdialog.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx (Route /admin/inquiries/:id/preview)`_
- **Angebots-Versionierung & Archiv** · 🟠 regelmäßig  
  Jeder Versand erzeugt eine unveraenderliche Version (inquiry_offer_history). Archiv-Ansicht zeigt E-Mail, Angebotsseite und PDF der Version; Aktion 'Als neues Angebot kopieren'. Nach-Versand-Aenderungen werden erkannt (Diff zum letzten Snapshot).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/OfferArchivePreview.tsx (Route /admin/inquiries/:id/archive/:version), OfferBuilder.tsx`_
- **Kundensprache & KI-Uebersetzung** · 🟠 regelmäßig  
  Sprachwahl je Kunde im Header (DE/EN/...); Mismatch-Banner wenn Anschreiben/Menuetexte noch in anderer Sprache sind, Dialog uebersetzt Anschreiben, Kundennachricht, Menue und Paketbeschreibungen per KI.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx, LanguageSwitchDialog.tsx, CustomerLanguageSelector.tsx`_
- **Zahlungsmanagement (Stripe)** · 🔴 täglich  
  Zahlungen je Event anlegen (Anzahlung/Vorauszahlung/Restzahlung, online oder vor Ort), Stripe-Zahlungslink erzeugen/versenden/kopieren, Zahlungserinnerung senden, Zahlung stornieren, Betrag auf Netto-Rest korrigieren, als bezahlt vermerken; Anzahlungs- und Schlussrechnung in LexOffice erzeugen. Kompakter Payment-Status-Strip im Angebot-Tab.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/PaymentCard.tsx, AddPaymentDrawer.tsx, PaymentStatusStrip.tsx`_
- **Digitale Kostenuebernahme (eSignatures)** · 🟠 regelmäßig  
  Kostenuebernahme mit rechtsgueltiger digitaler Unterschrift via eSignatures.com: anstossen, Statusverfolgung (wartet auf Signatur/gestartet/unterschrieben), zurueckziehen, Signatur erneut starten, Audit-Drawer. Nach Unterschrift ist das Angebot gesperrt (Preis/Menue/Termin nur ueber neue Version).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/CostAcceptanceCard.tsx, CostAcceptanceAuditDrawer.tsx, SmartInquiryEditor.tsx (isSignatureLocked)`_
- **LexOffice-Belege & Rechnungsversand** · 🔴 täglich  
  Karte mit allen LexOffice-Belegen des Vorgangs (Angebot/Rechnung) inkl. PDF-Vorschau und Download; 'Rechnung schicken' mit Vorschau-Dialog; Sonderlogik 'Restzahlung vor Ort' (keine LexOffice-Schlussrechnung, POS-Beleg).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/LexofficeDocumentsCard.tsx, SendInvoiceDialog.tsx, LexofficeDocumentPreviewDialog.tsx`_
- **Nachrichten-Tab (Mail-Client je Vorgang)** · 🔴 täglich  
  E-Mail-Thread mit dem Kunden direkt im Vorgang (Chat-artige Ansicht, Anhaenge), Antworten aus Maestro heraus (send-offer-email mit CC/BCC). Untertab 'Mails zuordnen': eingehende Mails dem Event zuordnen, ausblenden, Anhaenge herunterladen.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/shared/MailClient.tsx, MailComposer.tsx, /home/user/events-storia.de/src/components/admin/refine/InquiryEditor/EventMailsTab.tsx`_
- **Aufgaben & interne Notizen je Anfrage** · 🔴 täglich  
  Task-Manager mit Quick-Presets, Faelligkeitsdatum, Ueberfaellig-/Heute-/Morgen-Markierung und Erledigt-Liste; separates Feld fuer interne Notizen.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/shared/TaskManager.tsx, /home/user/events-storia.de/src/components/admin/refine/InquiryEditor/StaffNote.tsx`_
- **Details-Tab: Event-Stammdaten & Location** · 🔴 täglich  
  Bearbeiten von Datum, Uhrzeit, Gaestezahl, Anlass, Kontakt/Firma; Zuweisung an Teammitglied und Prioritaet; Location-Block mit Storia/beim Kunden/eigene Adresse inkl. Adress-Autocomplete (Nominatim); Original-Kundenanfrage und Kunden-Anhaenge einsehbar.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/EventDNACard.tsx, LocationBlock.tsx, NominatimAutocomplete.tsx, CustomerAttachmentsCard.tsx`_
- **Kunden-Ansicht & Aktivitaeten-Timeline** · 🟠 regelmäßig  
  Button oeffnet die oeffentliche Angebotsseite so wie der Kunde sie sieht (neuer Tab); Client-Preview-Karte im Details-Tab; Aktivitaeten-Tab mit vollstaendigem Audit-Log des Vorgangs (Versand, Statuswechsel, Zahlungen).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx (buildAdminPublicOfferUrl), ClientPreview.tsx, /home/user/events-storia.de/src/componen`_
- **Kuechen-/Service-Drucke** · 🟠 regelmäßig  
  Druckmenue je Vorgang: Kuechenzettel, Servicezettel und kompletter Auftragsbogen als PDF mit Vorschau.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/print/PrintMenu.tsx, KitchenSheet.tsx, ServiceSheet.tsx, FullOrderSheet.tsx`_
- **Kundenkonto-Einladung & E-Mail-Fehlerbanner** · 🟡 selten  
  Kunde kann per Button ein Kundenkonto-Invite erhalten (Status eingeladen/aktiviert sichtbar); Banner warnt bei fehlgeschlagener Mailzustellung im Vorgang.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/shared/InviteCustomerAccountButton.tsx, /home/user/events-storia.de/src/components/admin/refine/InquiryEditor/EmailFailureBanner.ts`_

## Catering-Bestellungen (14)

- **Bestellliste (Tabelle + Kanban)** · 🔴 täglich  
  Alle Shop-Bestellungen mit Filter-Pills und umschaltbarer Kanban-Ansicht (Eingegangen unbezahlt / Neu·Bestaetigt / Erledigt / Storniert); Spalten fuer Liefertermin, Lieferung/Abholung, Kunde, Kontakt, Summe und Kommunikationsstatus; Ansichtswahl persistiert.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/OrdersList.tsx, OrdersKanbanView.tsx (Route /admin/orders)`_
- **Bestell-Editor** · 🔴 täglich  
  Positionen bearbeiten (aus Speisenkatalog hinzufuegen, Menge/entfernen), Status setzen (eingegangen/bestaetigt/erledigt/storniert), Lieferung vs. Abholung, Datum/Uhrzeit/Lieferadresse, Liefergebuehr automatisch nach Distanz neu berechnen, Zahlungsstatus (Stripe), Stornieren mit automatischer Stripe-Rueckerstattung oder manuell als erstattet markieren, LexOffice-Beleg erstellen und herunterladen, Kundenkonto-Einladung, interne Notizen, Aktivitaeten-Timeline, Kuechen-/Service-Druck.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/CateringOrderEditor.tsx (Route /admin/orders/:id/edit)`_
- **Bestell-Liste mit Lebenszyklus-Filtern** · 🔴 täglich  
  Filter Eingang (pending+confirmed) / Erledigt / Storniert / Alle, Kanban-Alternative mit Statuswechsel; Bestellungen werden 1h nach Liefer-/Abholzeit automatisch auf 'completed' gesetzt (pg_cron).  
  _Evidenz: `src/components/admin/refine/OrdersList.tsx, OrdersKanbanView.tsx`_
- **Bestell-Editor mit Storno & Liefergebühr** · 🔴 täglich  
  Bestellung bearbeiten (Positionen, Kunde, Liefer-/Abholdaten, interne Notizen), Liefergebühr automatisch nach Distanz berechnen (calculate-delivery inkl. Zuschlägen), LexOffice-Beleg erzeugen/downloaden, Bestellung stornieren mit automatischer Stripe-Rückerstattung oder manuell 'als zurückerstattet' markieren; Aktivitäten-Tab.  
  _Evidenz: `src/components/admin/refine/CateringOrderEditor.tsx`_
- **Küchen-/Service-/Komplett-Zettel drucken** · 🔴 täglich  
  Druckmenü pro Vorgang mit drei PDF-Typen: Küchenzettel (Menü + Allergene), Servicezettel (inkl. Lieferadresse, Equipment & Personal) und kompletter Auftragszettel mit Preisen; vor dem Rendern werden offene Auto-Saves geflusht.  
  _Evidenz: `src/components/admin/refine/print/PrintMenu.tsx, KitchenSheet.tsx, ServiceSheet.tsx, FullOrderSheet.tsx`_
- **Bestellbestätigung (Kunde + intern)** · 🔴 täglich  
  Versendet nach einer Shop-Bestellung die Bestätigungsmail an den Kunden (zweisprachig, mit allen Positionen, Liefer-/Abholdaten) und eine interne Benachrichtigung an info@; prüft E-Mail-Übereinstimmung gegen die gespeicherte Bestellung.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-order-notification/index.ts`_
- **Bestellung stornieren mit Rückerstattung** · 🟠 regelmäßig  
  Storniert eine Catering-Bestellung: erstellt automatisch die Stripe-Rückerstattung und bei vorhandener LexOffice-Rechnung die Gutschrift (nur Admin).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/cancel-catering-order/index.ts`_
- **Storno-Benachrichtigung** · 🟠 regelmäßig  
  Versendet die Storno-Mails an Kunde (mehrsprachig) und intern, inkl. Status von Rückerstattung und Gutschrift.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-cancellation-notification/index.ts`_
- **KI-Storno-Text generieren** · 🟡 selten  
  Generiert aus Admin-Stichworten einen höflichen deutschen Storno-Mailtext (Ton wählbar: förmlich/warm/entschuldigend, Kontext Bestellung/Buchung/Anfrage).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/ai-cancellation-message/index.ts`_
- **Liefer-Erinnerung + Auto-Abschluss** · 🔴 täglich  
  Stündlicher pg_cron-Job: erinnert das Team (info@events-storia.de + info@ristorantestoria.de) 2 Tage vor Lieferung/Abholung an anstehende Bestellungen und setzt vergangene Bestellungen automatisch auf erledigt.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/process-order-reminders/index.ts, /home/user/events-storia.de/supabase/migrations/20260416_catering_orders_pgcron.sql`_
- **Menü-Bestätigungsmail** · 🟠 regelmäßig  
  Versendet dem Kunden die finale Menü-Bestätigung zu einer Buchung (mehrsprachig) und protokolliert den Versand.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-menu-confirmation/index.ts`_
- **Catering-Bestellverwaltung (catering_orders)** · 🔴 täglich  
  Bestellungen mit Bestellnummer, Kunde/Firma, strukturierter Lieferadresse (Etage, Aufzug) oder Abholung, Wunschtermin, Positionen (JSONB), Lieferkosten, Mindermengenzuschlag, Rechnungsadresse, Zahlart/-status, Stripe/Lexoffice-Feldern (inkl. Gutschrift), Storno mit Grund und internen Notizen; heute Kompatibilitäts-View auf v2_events.  
  _Evidenz: `supabase/migrations/20251205181532, ALTER-Historie, 20260422220451 (View)`_
- **CX-Badges & Liefer-Erinnerungen** · 🔴 täglich  
  reminder_sent_at (Liefer-Erinnerung ans Team), last_customer_message_at / last_our_reply_at ('Neue Antwort' / 'Wartet auf Kunden'-Badges); stündlicher pg_cron-Job ruft die Edge Function process-order-reminders auf.  
  _Evidenz: `supabase/migrations/20260416_catering_orders_cx_overhaul.sql, 20260416_catering_orders_pgcron.sql`_
- **Bestellverwaltung** · 🔴 täglich  
  Bestellliste mit Statusfilter (pending/confirmed/completed/cancelled), Status ändern, interne Notizen, Bestellung löschen; Badge mit ausstehenden Bestellungen. Datensatz enthält Liefer-/Rechnungsadresse, Stockwerk/Aufzug, Lieferkosten, Mindermengenzuschlag, Distanz, Stornoinfos.  
  _Evidenz: `src/hooks/useCateringOrders.ts`_

## Rechnungen (LexOffice) (14)

- **Angebot/Rechnung aus Event erzeugen (zentral)** · 🔴 täglich  
  Zentrale Beleg-Engine: erzeugt aus einem Event ein LexOffice-Angebot oder eine Rechnung mit detaillierten Positionen (Menü-Gänge, Getränke pauschal/einzeln/Weinbegleitung, Equipment, Personal, Rabatte in Prozent/Betrag, per_person- oder per_event-Preise, Freitext-Programme, Anzahlungs-/Restzahlungskonditionen); erkennt und refresht veraltete Angebote statt Duplikate zu erzeugen.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-event-quotation/index.ts`_
- **Rechnung für Shop-Bestellung erzeugen** · 🔴 täglich  
  Erstellt die LexOffice-Rechnung für eine Catering-Shop-Bestellung mit Positionen, Liefergebühr, Mindermengenzuschlag und korrekter MwSt-Aufteilung.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-lexoffice-invoice/index.ts`_
- **Anzahlungsrechnung erzeugen** · 🟠 regelmäßig  
  Erzeugt nach bezahlter Anzahlung/Vorauszahlung automatisch eine UStG-konforme Anzahlungsrechnung in LexOffice (Brutto, USt separat, Bezug zum Veranstaltungsdatum); idempotent pro Zahlung.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-lexoffice-downpayment-invoice/index.ts`_
- **Schlussrechnung erzeugen** · 🟠 regelmäßig  
  Erzeugt die Schlussrechnung eines Auftrags: sammelt alle Anzahlungsrechnungen und zieht sie als negative Positionen ab (Paragraph 14 Abs. 5 UStG); idempotent pro Event.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-lexoffice-final-invoice/index.ts`_
- **Manuelle Rechnung/Angebot erstellen** · 🟠 regelmäßig  
  Erstellt eine freie Rechnung oder ein Angebot in LexOffice mit beliebigen Positionen (7% oder 19% MwSt), Kontakt, Adresse, Einleitung und Bemerkung — optional verknüpft mit einer Anfrage.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-manual-invoice/index.ts`_
- **Rechnung stornieren / Gutschrift** · 🟡 selten  
  Storniert eine LexOffice-Rechnung; bei finalisierten Rechnungen wird automatisch eine Gutschrift als Gegenbeleg erzeugt. Setzt anschließend die Referenzen in Maestro zurück (nur Admin-Rolle).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/void-lexoffice-invoice/index.ts`_
- **Zahlstatus-Abgleich mit LexOffice** · 🟠 regelmäßig  
  Gleicht den Bezahlt-Status von Bestell-Rechnungen mit LexOffice ab (einzeln oder alle) und aktualisiert die lokalen Bestellungen.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/sync-lexoffice-payment-status/index.ts`_
- **Einzelrechnung manuell re-synchronisieren** · 🟡 selten  
  Manueller Sync-Trigger für eine Rechnung (per LexOffice-ID oder Zahlungs-ID), optional mit Konflikt-Override (force_overwrite).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/sync-lexoffice-invoice/index.ts`_
- **LexOffice-Webhook (Rechnungsänderungen)** · ⚙️ intern  
  Empfängt invoice.changed-Events von Lexware mit RSA-Signaturprüfung und stößt automatisch den Sync der betroffenen Rechnung an — Statusänderungen in LexOffice landen so von selbst in Maestro.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/lexoffice-webhook/index.ts`_
- **Belegübersicht pro Auftrag** · 🔴 täglich  
  Sammelt alle LexOffice-Belege eines Auftrags (Angebot, Anzahlungs-, Schluss-, Standardrechnungen) und reichert sie mit Nummer, Datum, Bruttobetrag, Status und Versandhistorie an.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/list-lexoffice-documents/index.ts`_
- **Globale Belegliste mit Filtern** · 🟠 regelmäßig  
  Listet LexOffice-Belege (Rechnungen/Angebote/Gutschriften) mit Status- und Datumsfiltern, paginiert, und verknüpft sie mit lokalen Bestellungen samt Zahlstatus.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/list-lexoffice-vouchers/index.ts`_
- **Beleg-PDF abrufen** · 🟠 regelmäßig  
  Lädt das PDF eines LexOffice-Belegs (Rechnung/Angebot/Gutschrift) für die Anzeige/den Download im Admin, mit Retry-Logik bei Rate-Limits.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/get-lexoffice-document/index.ts, /home/user/events-storia.de/supabase/functions/get-lexoffice-document-by-id/index.ts`_
- **Rechnungs-E-Mail an Kunden** · 🟠 regelmäßig  
  Versendet die Rechnung per E-Mail an den Kunden (mehrsprachig, mit zusätzlicher Notiz und Dry-Run-Vorschau) und protokolliert den Versand.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-invoice-email/index.ts`_
- **LexOffice-Rohdaten-Inspektor (Debug)** · ⚙️ intern  
  Minimal-Tool: gibt die rohe LexOffice-API-Antwort zu einer Beleg-ID zurück (Fehleranalyse).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/lex-inspect/index.ts`_

## Anfragen (13)

- **KI-Anfrage-Parser (Freitext zu Strukturdaten)** · 🟠 regelmäßig  
  Wandelt frei eingefügten Anfragetext (z.B. aus E-Mails) per KI in strukturierte Felder um: Kontakt, Firma, Datum, Uhrzeit, Gästezahl, Anlass, plus Paket- und Positionsvorschläge mit Konfidenz.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/parse-inquiry-text/index.ts`_
- **Anfragen-Liste mit Statusfilter** · 🔴 täglich  
  Lädt alle Event-Anfragen sortiert nach Eingang, filterbar nach Status (new/contacted/offer_sent/confirmed/declined). Testdatensätze werden standardmäßig ausgeblendet.  
  _Evidenz: `src/hooks/useEventInquiries.ts`_
- **Vereinheitlichte Anfragen-Übersicht (Events + Catering)** · 🔴 täglich  
  Führt v2_events und Catering-Bestellungen zu einer Liste zusammen (für Kanban/Tabelle), mit Retry-Logik, Auto-Refresh bei Fensterfokus und Testdaten-Filter.  
  _Evidenz: `src/hooks/useUnifiedInquiries.ts`_
- **Status ändern, interne Notizen, Anfrage löschen** · 🔴 täglich  
  Mutationen zum Setzen des Anfrage-Status, Speichern interner Notizen und endgültigem Löschen einer Anfrage.  
  _Evidenz: `src/hooks/useEventInquiries.ts (useUpdateInquiryStatus, useUpdateInquiryNotes, useDeleteInquiry)`_
- **Handlungsstatus-Ampel (Kanban/Tabelle)** · 🔴 täglich  
  Leitet pro Anfrage/Bestellung einen einheitlichen Handlungszustand ab: 'Kunde wartet' (rot), 'In Bearbeitung' (gelb), 'Gebucht' (grün), 'Archiviert/Storniert' (grau) — inkl. Sonderfall 'Kunde hat auf Angebot reagiert'.  
  _Evidenz: `src/lib/inquiryActionState.ts`_
- **Team-Kommentare mit Antwort-Threads** · 🔴 täglich  
  Kommentare an einer Anfrage hinzufügen, bearbeiten, löschen; verschachtelte Antworten (parent_id) werden als Baum dargestellt.  
  _Evidenz: `src/hooks/useInquiryComments.ts`_
- **Datei-Anhänge mit signierten Download-Links** · 🟠 regelmäßig  
  Zeigt hochgeladene Anhänge einer Anfrage (z.B. aus dem KI-Chat) und erzeugt zeitlich begrenzte Download-URLs über eine Edge Function.  
  _Evidenz: `src/hooks/useInquiryAttachments.ts`_
- **Anwesenheits-Anzeige (Wer arbeitet gerade hier?)** · 🔴 täglich  
  Supabase Realtime Presence zeigt live, welche Kollegen dieselbe Anfrage ansehen oder gerade bearbeiten ('Madina bearbeitet gerade...') — verhindert Doppelbearbeitung.  
  _Evidenz: `src/hooks/usePresence.ts`_
- **Aktivitätsprotokoll (Timeline)** · 🔴 täglich  
  Vollständige Historie pro Anfrage mit ~30 Aktionstypen in deutscher Klartext-Formatierung: Statuswechsel, Preisänderungen, E-Mail-Versand, Zahlungseingang, LexOffice-Rechnung, Gästezahl-Änderung etc. Eigene Aktionen können geloggt werden.  
  _Evidenz: `src/hooks/useActivityLog.ts`_
- **KI-Herkunfts-Badge** · 🟠 regelmäßig  
  Markiert in Kanban/Tabelle live (Realtime) alle Anfragen, die über den öffentlichen KI-Chat entstanden sind (Signal: ai_conversations.inquiry_id).  
  _Evidenz: `src/hooks/useAiOriginInquiries.ts`_
- **Zustellfehler-Warnung auf Karten** · 🟠 regelmäßig  
  Kanban-Karten mit unerledigten E-Mail-Zustellfehlern werden rot umrandet und mit Alarm-Emoji markiert; aktualisiert sich per Realtime sofort.  
  _Evidenz: `src/hooks/useFailedDeliveryInquiries.ts`_
- **Quellen-Erkennung (Herkunftslabel)** · 🟠 regelmäßig  
  Übersetzt technische source-Werte in Labels (Kontaktformular, Paket-Anfrage, E-Mail-Posteingang, Telefon, Funnel) und extrahiert ggf. die Paket-ID aus der Quelle.  
  _Evidenz: `src/lib/inquirySource.ts`_
- **Testdaten-Modus** · 🟠 regelmäßig  
  Schalter, der Test-/interne Datensätze in allen Listen, Dashboards und Auswertungen ein-/ausblendet. Erkennung dreistufig: is_test-Flag, bekannte interne E-Mail-Adressen, interne Namen/Firmen (Speranza, Monot etc.) als Wort-Match.  
  _Evidenz: `src/contexts/TestModeContext.tsx, src/lib/testRecords.ts`_

## Website-Beruehrungspunkte (12)

- **Event-/Catering-Anfrageformular** · 🔴 täglich  
  Oeffentliches Kontakt-/Eventformular der Website sendet Anfragen via Edge-Function receive-event-inquiry; sie erscheinen als 'Neu' in der Maestro-Anfragenliste. Kontaktseite zusaetzlich mit NAP, Anfahrt und Google Maps (Consent).  
  _Evidenz: `/home/user/events-storia.de/src/components/events/EventContactForm.tsx, /home/user/events-storia.de/src/pages/Kontakt.tsx`_
- **Oeffentliche Angebotsseite (Kundenseite)** · 🔴 täglich  
  Kunde oeffnet /offer/:id bzw. /ihr-angebot/:slug: phasenabhaengige Ansicht (Proposal → Danke → finales Angebot → Bestaetigung), Option waehlen, antworten/Rueckfragen (notify-customer-response), Kostenuebernahme digital unterschreiben, per Stripe anzahlen oder komplett zahlen, Bestellung bestaetigen (confirm-order), Angebots-PDF herunterladen, mehrsprachig (DE/EN u.a.), Restaurant-Galerie; Admin sieht Aenderungen live in Maestro.  
  _Evidenz: `/home/user/events-storia.de/src/pages/PublicOffer.tsx, /home/user/events-storia.de/src/pages/public-offer/ (ProposalView, FinalOfferView, CostAcceptanceSection, PaymentSection, Pdf`_
- **Restzahlungsseite** · 🟠 regelmäßig  
  Oeffentliche Seite /restzahlung/:slug (auch EN): Kunde zahlt die Restsumme per Stripe-Checkout (create-balance-checkout) — Gegenstueck zu den in Maestro angelegten Restzahlungen.  
  _Evidenz: `/home/user/events-storia.de/src/pages/Restzahlung.tsx`_
- **Catering-Shop & Checkout** · 🔴 täglich  
  Warenkorb auf den Catering-Seiten, Checkout mit Lieferkostenberechnung (calculate-delivery), Zahlung via Stripe oder Billie (Rechnungskauf), Bestellbestaetigung/Erfolgsseite; Bestellungen laufen in Maestro als Catering-Bestellungen auf, Mails via Stripe-Webhook.  
  _Evidenz: `/home/user/events-storia.de/src/pages/Checkout.tsx, /home/user/events-storia.de/src/pages/OrderSuccess.tsx, /home/user/events-storia.de/src/components/cart/`_
- **Gutschein-Kauf** · 🟠 regelmäßig  
  Oeffentliche Gutscheinseite mit Stripe-Checkout (create-voucher-checkout) und Danke-Seite; gekaufte Gutscheine werden in Maestro unter /admin/gutscheine geprueft und eingeloest.  
  _Evidenz: `/home/user/events-storia.de/src/pages/Gutschein.tsx, GutscheinDanke.tsx`_
- **Kundenkonto** · 🟠 regelmäßig  
  Kunden-Login/Registrierung, Profilverwaltung und Bestelluebersicht mit Rechnungs-Download aus LexOffice (get-lexoffice-document), Passwort-Reset; Konten koennen aus Maestro heraus per Einladung angelegt werden.  
  _Evidenz: `/home/user/events-storia.de/src/pages/CustomerAuth.tsx, CustomerProfile.tsx, PasswordReset.tsx`_
- **Tischreservierung via OpenTable-Widget** · 🟠 regelmäßig  
  Restaurant-Gaeste koennen ueber ein consent-geschuetztes OpenTable-Widget auf Startseite/Kontakt/Events-Seite direkt einen Tisch reservieren.  
  _Evidenz: `/home/user/events-storia.de/src/components/ConsentOpenTable.tsx, eingebunden in src/pages/Index.tsx, src/pages/Kontakt.tsx, src/pages/catering/EventsImStoria.tsx`_
- **Google-Maps-Anfahrtskarte mit Consent-Gate** · 🟡 selten  
  Eingebettete Google-Maps-Karte (Anfahrt zur Location), die erst nach Cookie-Einwilligung geladen wird.  
  _Evidenz: `/home/user/events-storia.de/src/components/ConsentGoogleMaps.tsx`_
- **Google-Bewertungen-Widget (Elfsight) mit Consent-Gate** · 🟡 selten  
  Kundenbewertungen werden ueber ein consent-geschuetztes Elfsight-Widget auf der Website angezeigt (u.a. in Event-Testimonials).  
  _Evidenz: `/home/user/events-storia.de/src/components/ConsentElfsightReviews.tsx, /home/user/events-storia.de/src/components/events/EventTestimonials.tsx`_
- **Warenkorb 'Fuer spaeter speichern' (30 Tage)** · 🟡 selten  
  Kunden koennen ihre Checkout-Eingaben/den Warenkorb lokal fuer 30 Tage speichern und beim naechsten Besuch wiederherstellen oder loeschen.  
  _Evidenz: `/home/user/events-storia.de/src/components/checkout/SaveForLaterCheckbox.tsx (EXPIRY_DAYS=30, isRestored/onClearSaved)`_
- **Newsletter-Opt-in in Anfrageformular und Checkout** · 🟡 selten  
  Event-Kontaktformular und Shop-Checkout enthalten eine (vorausgewaehlte) Newsletter-Anmeldung, die mit der Anfrage/Bestellung erfasst wird.  
  _Evidenz: `/home/user/events-storia.de/src/components/events/EventContactForm.tsx (Z. 45, 411-414), /home/user/events-storia.de/src/pages/Checkout.tsx (Z. 234)`_
- **Schwebende Schnellkontakt-Buttons (Telefon)** · 🟠 regelmäßig  
  Scroll-abhaengig eingeblendete Floating-Buttons zum direkten Anrufen bzw. Kopieren der Telefonnummer (Desktop) plus mobile Sticky-Action-Bar; auf Admin-/Checkout-/Angebotsseiten ausgeblendet.  
  _Evidenz: `/home/user/events-storia.de/src/components/FloatingActions.tsx, /home/user/events-storia.de/src/components/MobileStickyActionBar.tsx`_

## Dashboard (10)

- **Pinnwand: priorisierte Aufgaben-Worklist** · 🔴 täglich  
  Startseite mit Begruessung und Tageszahlen (jetzt / SLA-kritisch / heute / diese Woche). Tabelle aller anstehenden Aufgaben (unbeantwortete Anfragen, unbestaetigte Menues, ueberfaellige Zahlungen, heutige Operationen) mit Faelligkeit, Grund, Snooze-Funktion und Klick-Navigation zum Vorgang.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/dashboard/Pinnwand.tsx, WorklistTable.tsx, /home/user/events-storia.de/src/lib/dashboardPriority.ts`_
- **Worklist-Filter** · 🔴 täglich  
  Filtern der Aufgabenliste nach Prioritaets-Bucket (alle/jetzt/SLA/heute/Woche), Service-Typ (Restaurant/Catering/Anfrage/Zahlung) und Freitextsuche.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/dashboard/WorklistFilters.tsx`_
- **Tages-Timeline** · 🔴 täglich  
  Kalender-Sidebar (Schedule-X Tagesansicht 8-23 Uhr) mit heutigen Lieferungen/Abholungen und Events; Klick springt zum Vorgang.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/dashboard/DayTimelineSidebar.tsx`_
- **Wochen-Sparkline & E-Mail-Fehler-Kachel** · 🟠 regelmäßig  
  Mini-Chart der Auslastung nach Wochentagen; Alarm-Kachel bei fehlgeschlagenen E-Mail-Zustellungen mit Direktsprung zur betroffenen Anfrage.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/dashboard/WeekSparkline.tsx, EmailFailureTile.tsx`_
- **Pinnwand-Arbeitsliste mit Prioritäts-Buckets** · 🔴 täglich  
  Personalisierte Startseite (Begrüßung mit Vorname) mit priorisierter To-do-Tabelle in Buckets 'Jetzt / SLA-kritisch / Heute / Diese Woche / Offen', Live-Aktualisierung, Klick öffnet den Vorgang.  
  _Evidenz: `src/components/admin/refine/dashboard/Pinnwand.tsx, WorklistTable.tsx`_
- **Aufgaben snoozen und filtern** · 🔴 täglich  
  Worklist-Einträge lassen sich 4 oder 24 Stunden snoozen; Filter nach Bucket, Service-Typ (Event/Catering/Restaurant) und Freitext.  
  _Evidenz: `src/components/admin/refine/dashboard/WorklistTable.tsx, WorklistFilters.tsx`_
- **Tages-Timeline & Wochen-Sparkline** · 🔴 täglich  
  Sidebar mit heutigen Operationen (Lieferungen/Events des Tages) und Mini-Chart der Auslastung nach Wochentag; separate Kachel für E-Mail-Zustellfehler.  
  _Evidenz: `src/components/admin/refine/dashboard/DayTimelineSidebar.tsx, WeekSparkline.tsx, EmailFailureTile.tsx`_
- **Operativer Tagesüberblick (Pinnwand)** · 🔴 täglich  
  Zusammenführung von Catering-Lieferungen/Abholungen, Event-Buchungen und bestätigten Anfragen der nächsten 7-14 Tage mit Uhrzeit, Adresse, Gästezahl, Zahlungs- und Menüstatus; dazu Posteingang der letzten 48h mit 'unbeantwortet'-Erkennung (via Mail-Log), liegengebliebene Anfragen (>5 Tage ohne Angebot), überfällige Zahlungen und Wochenstatistik inkl. Umsatz/bezahlt. Auto-Refresh je Minute.  
  _Evidenz: `src/hooks/useDashboardData.ts`_
- **Prioritäten-Engine mit SLA-Buckets** · 🔴 täglich  
  Wandelt alle Dashboard-Daten in eine priorisierte Aufgabenliste mit Buckets 'Jetzt', 'SLA-kritisch', 'Heute', 'Diese Woche', 'Offen' — Scoring nach Dringlichkeit (24h ohne Antwort, Menü unbestätigt <48h, Zahlung überfällig); Uhr aktualisiert alle 30s.  
  _Evidenz: `src/lib/dashboardPriority.ts, src/hooks/useDashboardTasks.ts`_
- **Aufgaben-Snooze** · 🟠 regelmäßig  
  Einzelne Pinnwand-Aufgaben lassen sich für X Stunden zurückstellen (localStorage); zurückgestellte Aufgaben rutschen in den 'Offen'-Bucket mit Snoozed-Kennzeichnung.  
  _Evidenz: `src/lib/dashboardPriority.ts (snoozeTask/unsnoozeTask)`_

## Zahlungen (Stripe) (10)

- **Zentraler Stripe-Webhook** · 🔴 täglich  
  Verarbeitet checkout.session.completed signaturgeprüft und routet auf 7 Zahlungstypen: Catering-Bestellung, Angebots-Option, Multi-Option, Event-Direktbuchung, Maestro-Zahlung (Anzahlung/Voraus), Prepayment pro Person, Gutschein-Kauf. Setzt Status, stößt Bestätigungen und bei Gutscheinen PDF-Erzeugung + Versand an.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/handle-stripe-webhook/index.ts`_
- **Checkout von der Angebotsseite** · 🟠 regelmäßig  
  Erzeugt eine Stripe-Checkout-Session aus der öffentlichen Angebotsseite: Vollzahlung oder Anzahlung, auch für mehrere Optionen mit Mengen; Beträge inkl. Freitext-Programm- und Rabattlogik serverseitig berechnet.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-payment-session/index.ts`_
- **Checkout für Zahlungsposition (Admin)** · 🟠 regelmäßig  
  Admin/Staff erzeugt eine Stripe-Checkout-Session für eine konkrete Event-Zahlungsposition (event_payments-Zeile).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-event-payment-session/index.ts`_
- **Zahlungslink für Angebots-Option** · 🟠 regelmäßig  
  Erstellt einen Stripe-Zahlungslink für eine konkrete Angebots-Option (Paket, Betrag, Eventdatum, Gästezahl) zum Versand an den Kunden.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-offer-payment-link/index.ts`_
- **Prepayment-Link mit anpassbarer Gästezahl** · 🟠 regelmäßig  
  Erstellt einen Stripe Payment Link mit Preis pro Person und vom Kunden anpassbarer Menge (min = Gästezahl, max konfigurierbar); optional wird direkt die Einladungs-Mail verschickt.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-prepayment-link/index.ts`_
- **Restzahlungs-Link mit eigener Seite** · 🟠 regelmäßig  
  Erzeugt für einen offenen Restbetrag einen sprechenden Slug-Link auf eine öffentliche Restzahlungsseite (mit Gästezahl-Grenzen) und versendet optional die E-Mail dazu.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-balance-payment-link/index.ts`_
- **Zahlungsstatus-Sicherheitsnetz** · ⚙️ intern  
  Abgleichslauf: prüft ob als bezahlt markierte Zahlungen korrekt im Event-Status reflektiert sind und korrigiert stille Webhook-Fehler.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/reconcile-payment-statuses/index.ts`_
- **Zahlungsaufforderung/-erinnerung per Mail** · 🟠 regelmäßig  
  Versendet Zahlungsaufforderungen, Erinnerungen oder Bestätigungen zu einer Zahlungsposition mit Stripe-Link, mehrsprachig mit zweisprachigem Betreff.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-payment-email/index.ts`_
- **Zahlungsbestätigung / Prepayment-Einladung** · 🟠 regelmäßig  
  Sendet Zahlungsbestätigungen oder Prepayment-Einladungen (Kunde gibt finale Gästezahl ein und zahlt Restbetrag per Karte); optional mit Entschuldigungstext bei verspäteter Bestätigung; mehrsprachig.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-payment-confirmation-v2/index.ts`_
- **Überfällige Zahlungen automatisch markieren** · ⚙️ intern  
  Täglicher pg_cron-Job (9 Uhr UTC) setzt versendete Zahlungspositionen mit überschrittenem Fälligkeitsdatum automatisch auf overdue.  
  _Evidenz: `/home/user/events-storia.de/supabase/migrations/20260408183038_3f4c9cca-dfe1-4040-9d8c-dc9378d42f3e.sql`_

## Stammdaten (9)

- **Speisen- & Getraenkeverwaltung** · 🟠 regelmäßig  
  Tabs Catering / Ristorante / Archiv / Papierkorb. Kategorien und Speisen anlegen/bearbeiten (Name/Beschreibung DE+EN, Preis, Bild-Upload), KI-Uebersetzung DE→EN, Drag&Drop-Sortierung von Kategorien und Speisen, Archivieren, Papierkorb mit Wiederherstellen und endgueltigem Loeschen.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/MenuItemsList.tsx (Route /admin/menu)`_
- **Pakete & Locations verwalten** · 🟠 regelmäßig  
  Zwei Tabs mit Karten aller Event-Pakete und Locations; Drag-Sortierung, Loeschen mit Bestaetigung, Direktlinks zu den Editoren.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/PackagesList.tsx (Route /admin/packages)`_
- **Paket-Editor** · 🟠 regelmäßig  
  Paket anlegen/bearbeiten: Name/Beschreibung DE+EN, Bild-Upload, Pakettyp, Preis + Preistyp, Min-/Max-Gaeste, Vorauszahlungspflicht mit Prozentsatz, Inklusivleistungen, Paket-Menuepositionen, KI-Menue-Uebersetzung; Gruppenreisen-Details (Untertitel, Waehrung, Dauer, Sprachen, Zielgruppen, Extras, Sichtbarkeit auf ristorantestoria.de).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/PackageEdit.tsx, PackageMenuItemsEditor.tsx (Routen /admin/packages/create, /admin/packages/:id/edit)`_
- **Location-Editor** · 🟡 selten  
  Location anlegen/bearbeiten: Name/Beschreibung DE+EN, Kapazitaet sitzend/stehend, Ausstattung & Features, Sortierung, aktiv/inaktiv.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/LocationEdit.tsx (Routen /admin/locations/create, /admin/locations/:id/edit)`_
- **Fotoalbum mit KI-Klassifizierung** · 🟠 regelmäßig  
  Zentrale Bildbibliothek: Drag&Drop-Upload, automatische KI-Kategorisierung und -Verschlagwortung neuer Fotos, Komplett-Reklassifizierung auf Knopfdruck, Filter nach KI-Kategorie/Tag und Suche, manuelle Ordner (anlegen/umbenennen/loeschen, Fotos zuordnen, Upload in Ordner), Mehrfachauswahl mit Bulk-Loeschen/-Archivieren, Foto-Metadaten bearbeiten, Fotos als Versionen verknuepfen.  
  _Evidenz: `/home/user/events-storia.de/src/pages/admin/Fotoalbum.tsx, /home/user/events-storia.de/src/components/admin/PhotoDropzone.tsx (Route /admin/fotos)`_
- **Speisen & Getränke verwalten** · 🟠 regelmäßig  
  Katalogverwaltung mit Tabs Catering / Ristorante / Archiv / Papierkorb: Kategorien und Artikel anlegen/bearbeiten/archivieren/löschen, mehrsprachige Namen (DE/EN), Bild-Upload oder URL, Preis plus freie Preis-Anzeige-Texte ('ab 12,90 €', 'Pro Person', 'Ab 10 Personen'), Suche.  
  _Evidenz: `src/components/admin/refine/MenuItemsList.tsx, src/components/admin/CategoryEditor.tsx, MenuItemEditor.tsx`_
- **Event-Pakete verwalten** · 🟠 regelmäßig  
  Pakete mit mehrsprachigem Namen/Beschreibung, Preistyp (pro Person/pauschal), Min-/Max-Gäste, Dauer, Inklusivleistungen, Extras, Zielgruppen, Sprachen, Vorauszahlungs-Pflicht (%), Location-Zuordnung, Bild, Website-Sichtbarkeit (ristorantestoria.de) und Sortierung per Drag&Drop; pro Paket Gänge-/Getränke-Konfiguration (welche Speisen wählbar sind).  
  _Evidenz: `src/components/admin/refine/PackageEdit.tsx, PackagesList.tsx, PackageMenuItemsEditor.tsx, MenuItemPicker.tsx`_
- **Locations (Räume) verwalten** · 🟡 selten  
  Veranstaltungsräume mit Kapazitäten (sitzend/stehend), Ausstattungsliste, mehrsprachiger Beschreibung und Sortierung anlegen und pflegen.  
  _Evidenz: `src/components/admin/refine/LocationEdit.tsx`_
- **Equipment-Katalog mit CSV-Import** · 🟡 selten  
  Katalog für Equipment/Personal-Positionen (Name, Menge, Preis/Einheit) mit Suche und Massenimport aus CSV/TSV/TXT (tolerante Trennzeichen- und Dezimal-Erkennung).  
  _Evidenz: `src/components/admin/refine/EquipmentCatalogCard.tsx`_

## Aufgaben (9)

- **Aufgaben & Follow-ups pro Anfrage** · 🔴 täglich  
  Aufgaben mit Fälligkeit und Zuweisung anlegen, abhaken, löschen; eigener Tab im Anfrage-Editor.  
  _Evidenz: `src/components/admin/shared/TaskManager.tsx`_
- **Persönliches Aufgaben-Widget** · 🔴 täglich  
  Widget mit meinen nächsten 8 Aufgaben, Überfällig-Zähler, Fälligkeits-Formatierung (heute/morgen), Erledigen per Klick und Sprung zur Anfrage.  
  _Evidenz: `src/components/admin/refine/TasksWidget.tsx`_
- **Interne Notizen & Kommentar-Threads** · 🔴 täglich  
  Freitext-Notiz pro Anfrage (auto-gespeichert) sowie Kommentar-Threads mit Antworten für Team-Kommunikation.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/StaffNote.tsx, src/components/admin/shared/CommentThread.tsx`_
- **Aufgaben-Fälligkeits-Erinnerungen** · 🟠 regelmäßig  
  Cron-Funktion: verschickt Erinnerungsmails an zuständige Mitarbeiter für fällige, noch nicht erinnerte Anfrage-Aufgaben (mit Kontext der Anfrage).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/process-follow-up-tasks/index.ts`_
- **Aufgabenverwaltung (v2_event_tasks)** · 🔴 täglich  
  Aufgaben pro Event oder frei, mit Titel, Beschreibung, Status (open/in_progress/done/cancelled), Priorität, Fälligkeit, Zuweisung und Erledigt-Tracking; Erinnerungs-Flag für automatische Task-Reminder-Mails.  
  _Evidenz: `supabase/migrations/20260204200000_inquiry_tasks.sql, 20260403000000_inquiry_tasks_reminder_sent.sql, 20260422202324`_
- **Aufgabenverwaltung mit Zuweisung und Priorität** · 🔴 täglich  
  Aufgaben je Anfrage oder frei: erstellen (inkl. Quick-Presets mit Fälligkeit in X Tagen), bearbeiten, erledigen (mit Wer/Wann), löschen; Filter nach Zuständigem und Status.  
  _Evidenz: `src/hooks/useTasks.ts`_
- **Anstehende und überfällige Aufgaben (Badges)** · 🔴 täglich  
  Listen der nächsten fälligen Aufgaben sowie Zähler überfälliger Aufgaben, optional pro Mitarbeiter.  
  _Evidenz: `src/hooks/useTasks.ts (useUpcomingTasks, useOverdueTasks)`_
- **Erinnerungs-Vorschau (Was verschickt der Cron als Nächstes?)** · 🔴 täglich  
  Zeigt bevorstehende automatische Erinnerungen mit geplantem Sendezeitpunkt: Follow-up-Tasks (täglich 08:00), Küchen-/Liefererinnerung (stündlich, 2 Tage vor Liefertermin), Zahlungsüberfälligkeit (09:00), Angebotserinnerung nach 3+ Tagen ohne Antwort (10:00, max. 2×); plus die zuletzt versendeten Erinnerungen der letzten 7 Tage.  
  _Evidenz: `src/hooks/useUpcomingReminders.ts`_
- **Erinnerung überspringen / Vorgang abschließen** · 🟠 regelmäßig  
  Einzelne geplante Erinnerungen können übersprungen werden (setzt reminder_sent bzw. zählt reminder_count hoch); Catering/Buchung/Anfrage lässt sich direkt als erledigt markieren.  
  _Evidenz: `src/hooks/useOperationActions.ts`_

## Rechnungen (8)

- **LexOffice-Belege pro Vorgang** · 🔴 täglich  
  Karte mit allen verknüpften LexOffice-Dokumenten (Angebot, Anzahlungsrechnung, Schlussrechnung): PDF-Großvorschau, Download, in LexOffice öffnen, stornieren mit Bestätigung; Sonderregel 'Restzahlung vor Ort → keine Schlussrechnung' (POS-Beleg), Alt-Rechnungen bleiben bedienbar.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/LexofficeDocumentsCard.tsx, LexofficeDocumentPreviewDialog.tsx, SmartInquiryEditor.tsx`_
- **Zentrale Rechnungsliste** · 🟠 regelmäßig  
  Übersicht aller LexOffice-Rechnungen mit Status-Badges, PDF-Vorschau/-Download und Direktlink in LexOffice.  
  _Evidenz: `src/components/admin/refine/LexOfficeInvoicesList.tsx, src/components/admin/shared/InvoiceStatusBadge.tsx`_
- **Manuelle Rechnung erstellen** · 🟡 selten  
  Dialog zum Anlegen einer freien LexOffice-Rechnung: Kundendaten (Name, Firma, Adresse, Kontakt), freie Positionen, Kopf- und Fußtext.  
  _Evidenz: `src/components/admin/refine/CreateManualInvoiceDialog.tsx`_
- **Rechnung per E-Mail senden** · 🟠 regelmäßig  
  Dialog zum Versand der (Anzahlungs-/Schluss-)Rechnung an den Kunden mit Sprachauswahl, E-Mail-Vorschau, PDF-Ansicht und automatischer Neu-Generierung der Rechnung mit aktuellen Werten.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/SendInvoiceDialog.tsx`_
- **LexOffice-Belegübersicht** · 🟠 regelmäßig  
  Listet Rechnungen, Angebote und Gutschriften aus LexOffice mit Filtern (Typ, Status, Zeitraum, Paginierung) und Verknüpfung zur lokalen Bestellung.  
  _Evidenz: `src/hooks/useLexOfficeVouchers.ts`_
- **Zahlungsstatus-Sync mit LexOffice** · 🟠 regelmäßig  
  Gleicht den Bezahlstatus einzelner oder aller Bestellungen mit LexOffice ab (Edge Function sync-lexoffice-payment-status).  
  _Evidenz: `src/hooks/useLexOfficeVouchers.ts (useSyncLexOfficePaymentStatus)`_
- **Manuelle Rechnung/Angebot erstellen** · 🟠 regelmäßig  
  Erstellt freie Rechnungen oder Angebote in LexOffice mit Positionen, Steuersätzen, Einleitung/Bemerkung, optional verknüpft mit einer Event-Anfrage.  
  _Evidenz: `src/hooks/useLexOfficeVouchers.ts (useCreateManualInvoice)`_
- **Belege je Auftrag inkl. PDF-Download und Storno** · 🟠 regelmäßig  
  Zeigt alle LexOffice-Dokumente eines Auftrags (Angebot, Anzahlungs-, Schlussrechnung) inkl. Versandhistorie; PDF-Download über Edge Function; Rechnungs-Storno mit sofortiger Cache-Invalidierung im Editor. Badge mit Anzahl offener Rechnungen.  
  _Evidenz: `src/hooks/useLexOfficeVouchers.ts, src/lib/lexofficeDocument.ts`_

## Kostenübernahme / eSignatur (8)

- **Digitale Kostenübernahme vom Kunden starten** · 🟠 regelmäßig  
  Kunde startet auf der öffentlichen Angebotsseite eine rechtsverbindliche Kostenübernahme: erzeugt einen eSignatures.com-Vertrag mit eingebetteter Signatur-Seite (iframe). Beträge kommen ausschließlich serverseitig aus Maestro; MFA-Regel: SMS-Verifikation ab 10.000 EUR oder bei B2C.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-cost-acceptance-from-public-offer/index.ts, /home/user/events-storia.de/supabase/functions/_shared/cost-acceptance-template.ts`_
- **eSignatures-Webhook (Vertrag signiert)** · ⚙️ intern  
  Empfängt contract-signed-Events mit HMAC-SHA256-Prüfung, lädt das signierte PDF, archiviert es im privaten Storage und setzt Status der Kostenübernahme und des Angebots.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/esignatures-webhook/index.ts`_
- **Signatur-Status öffentlich abfragen** · ⚙️ intern  
  Öffentlicher, PII-freier Status-Endpoint der aktuellsten Kostenübernahme einer Anfrage, damit die Angebotsseite die Signatur-UX über Reloads hinweg idempotent halten kann.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/get-public-cost-acceptance-state/index.ts`_
- **Signiertes PDF herunterladen (Admin)** · 🟠 regelmäßig  
  Gibt dem Admin eine kurz gültige signierte URL (5 Min.) für das signierte Kostenübernahme-PDF aus dem privaten Bucket.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/download-signed-cost-acceptance/index.ts`_
- **Kostenübernahme zurückziehen** · 🟡 selten  
  Zieht eine noch nicht unterschriebene Kostenübernahme zurück: storniert den Vertrag bei eSignatures.com und setzt den lokalen Status auf withdrawn.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/withdraw-cost-acceptance/index.ts`_
- **Kostenübernahme-E-Mail senden** · 🟠 regelmäßig  
  Versendet die Kostenübernahme-Aufforderung per Mail an den Unterzeichner, mehrsprachig mit zweisprachigen Betreffs und mandantenspezifischem Absender.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-cost-acceptance-email/index.ts`_
- **eSignatures-Template verwalten** · 🟡 selten  
  Setup und Versionierung des Kostenübernahme-Templates bei eSignatures.com: initiale Anlage (idempotent) und Update bei Textänderung; alte Kostenübernahmen behalten revisionssicher ihre Template-Version.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-esignatures-cost-acceptance-template/index.ts, /home/user/events-storia.de/supabase/functions/sync-esignatures-template/index.`_
- **Integrations-Health-Check eSignatures** · 🟡 selten  
  Zeigt dem Admin-Panel den Zustand der eSignatures-Anbindung (API-Key gesetzt, Template-ID/-Version, Webhook-URL) — ohne Secrets preiszugeben.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/esignatures-integration-status/index.ts`_

## Anfragen/Events (8)

- **Event-Akte mit Status-Pipeline (v2_events)** · 🔴 täglich  
  Zentrale Akte je Anfrage/Event mit 10-stufiger Status-Pipeline (inquiry → offer_sent → paid → completed / declined / cancelled / no_response), Datum/Uhrzeit, Gästezahl, Anlass, Service-Typ (Restaurant/Catering/Hybrid), Betrag, Buchungsnummer und Test-Flag.  
  _Evidenz: `supabase/migrations/20260422202324_a411adcd-d848-43e0-b3f8-1d2b08465cf3.sql (v2_event_status ENUM)`_
- **Zuweisung & Priorität** · 🔴 täglich  
  Anfragen können Teammitgliedern zugewiesen werden (assigned_to/at/by) und haben Priorität (low/normal/high/urgent) für Triage im Eingang.  
  _Evidenz: `supabase/migrations/20260204190000_assignment_priority.sql, 20260422202324 (v2_events.assigned_to, priority)`_
- **Archivierung von Anfragen** · 🟠 regelmäßig  
  Anfragen lassen sich archivieren (archived_at/by) ohne Statusverlust; die event_inquiries-View blendet archivierte Events aus.  
  _Evidenz: `supabase/migrations/20260204210000_inquiry_archive.sql, 20260422212017 (WHERE archived IS NOT TRUE)`_
- **Strukturierte Orte & Adressen pro Event** · 🔴 täglich  
  3-Modus-Veranstaltungsort (Storia / Firmenadresse / individuell), separate Firmenadresse und abweichende Rechnungsadresse, plus Catering-Lieferblock (Straße, Etage, Aufzug, Abholung, Distanz-km, Lieferkosten, Mindermengenzuschlag).  
  _Evidenz: `supabase/migrations/20260418132615_15bd0dbd-755b-4f6d-9adf-ce0cce086d13.sql, 20260422202324 (Location-/Billing-/Delivery-Block)`_
- **Änderungshistorie & Status-Log (v2_event_changelog)** · 🟠 regelmäßig  
  Jede Feldänderung und jeder Status-Wechsel wird automatisch protokolliert (Trigger trg_v2_events_log_status_change); Nutzer sehen wer wann was geändert hat, inkl. Grund.  
  _Evidenz: `supabase/migrations/20260422202324, 20260624120000_conversion_tracking.sql`_
- **Interne Kommentare mit Threads (v2_event_comments)** · 🔴 täglich  
  Team-Kommentare pro Event mit Antwort-Threads (parent_id) und Autor-E-Mail.  
  _Evidenz: `supabase/migrations/20260204191000_inquiry_comments.sql, 20260422202324 (v2_event_comments)`_
- **Anwesenheits-/Kollisionsanzeige (admin_presence)** · ⚙️ intern  
  Zeigt, welcher Admin gerade welchen Datensatz ansieht/bearbeitet (last_seen, is_editing) — verhindert Doppelbearbeitung im Team.  
  _Evidenz: `supabase/migrations/20260130001049_a52b8e8d-cf63-42f4-8090-ac6d901b3d28.sql`_
- **Audit-Trail (activity_logs)** · 🟠 regelmäßig  
  Generisches Aktivitätsprotokoll (Entity, Aktion, Akteur, Alt-/Neuwert) für Nachvollziehbarkeit über alle Objekte.  
  _Evidenz: `supabase/migrations/20260130001049_a52b8e8d-cf63-42f4-8090-ac6d901b3d28.sql`_

## Rechnungen/Zahlungen (8)

- **Zahlungsplan pro Event (v2_payments)** · 🔴 täglich  
  Mehrere Zahlungen je Event (Anzahlung, Vorauszahlung, Rest, Voll, Erstattung) mit Status (draft/sent/paid/overdue/...), Fälligkeit (Datum oder X Tage vor Event), Stripe-Checkout/Payment-Link, Lexoffice-Rechnungsnummer und Mahn-Zeitstempel.  
  _Evidenz: `supabase/migrations/20260408000000_event_payments.sql, 20260422202324 (v2_payments)`_
- **Fälligkeits-/Überfälligkeits-Ansicht (v2_payments_enriched)** · 🟠 regelmäßig  
  View berechnet effektives Fälligkeitsdatum und computed_status (overdue) inkl. Kundendaten; täglicher pg_cron-Job 'mark-overdue-event-payments' setzt versandte Zahlungen automatisch auf überfällig.  
  _Evidenz: `supabase/migrations/20260422202324 (View), 20260408183038 (cron.schedule)`_
- **Zahlungsarten-Konfiguration pro Event** · 🔴 täglich  
  payment_method/deposit_method (none/stripe/on_site/invoice), balance_method (stripe_prepay/on_site/invoice_after/invoice_before), Anzahlungs-Prozent, Fälligkeits-Tage, Angebots-Gültigkeit und invoice_due_days steuern den Zahlungs-Workflow und die Anzeige im öffentlichen Angebot.  
  _Evidenz: `supabase/migrations/20260403020000_payment_options.sql, 20260524215524, 20260607202855, 20260501193500`_
- **Öffentliche Restzahlungs-Links (balance_payment_links)** · 🟠 regelmäßig  
  Admin erlegt slug-basierte öffentliche Zahlseiten an (Preis pro Person, gezahlte Anzahlung, Gäste-Min/Max), Kunde wählt Gästezahl und zahlt Restbetrag; anon-RPC get_balance_payment_link_by_slug.  
  _Evidenz: `supabase/migrations/20260524231612, 20260624110111`_
- **Gutschein-Verkauf & -Einlösung (vouchers)** · 🟠 regelmäßig  
  Gutscheine (10–500 EUR) mit Code, Käufer/Empfänger, persönlicher Nachricht, Stripe-Session, Status pending/paid/redeemed/cancelled, Gültigkeitsdatum, Lexoffice-Rechnung und PDF; Einlösung durch Admin dokumentiert.  
  _Evidenz: `supabase/migrations/20260623235419_5914ff5d-77f0-48ae-9d78-fe0f362e267a.sql`_
- **Lexoffice-Sync (lexoffice_sync_log)** · 🟠 regelmäßig  
  Webhook-Protokoll für Lexoffice-Rechnungsereignisse mit applied/conflict/error und Verknüpfung zur v2-Zahlung; Events tragen Lexoffice-Angebots-/Rechnungs-IDs und Kunden Lexoffice-Kontakt-IDs.  
  _Evidenz: `supabase/migrations/20260603235812, 20260204220000_lexoffice_event_inquiries.sql`_
- **Beleg- & Buchungsnummern (order_number_sequences)** · ⚙️ intern  
  Atomare Nummernkreise pro Präfix+Jahr (get_next_order_number) und generate_booking_number für eindeutige Bestell-/Buchungsnummern.  
  _Evidenz: `supabase/migrations/20251206225558_299a0495-3d1b-417c-910b-a90ca074a75a.sql`_
- **Digitale Kostenübernahme mit eSignatur (cost_acceptances)** · 🟠 regelmäßig  
  Kostenübernahme-Dokument je Event mit Unterzeichner-Daten, 5 Pflicht-Checkboxen, eSignatures.io-Vertrag inkl. SMS-MFA, Versand-/Fehler-Tracking, Webhook-Events und signiertem PDF (Storage + SHA256); Download nur über geschützte Edge Function.  
  _Evidenz: `supabase/migrations/20260613194611, 20260616180900, 20260616200046`_

## Website (Berührungspunkt) (8)

- **KI-Anfrage-Assistent (Chat-Intake)** · 🔴 täglich  
  Öffentlicher Chat, der Eventdaten extrahiert (Name, E-Mail, Datum, Gästezahl als Pflichtfelder), Dateien annimmt (max. 10 Dateien / 15 MB einzeln / 50 MB gesamt, signierte Upload-URLs), die Sitzung nach Reload wiederherstellt, bei KI-Ausfall auf lokale Regex-Extraktion zurückfällt und nach Bestätigung eine Anfrage im MAESTRO erzeugt.  
  _Evidenz: `src/hooks/useAiIntake.ts, src/lib/aiIntake/*`_
- **Warenkorb mit Event/Catering-Trennung** · 🔴 täglich  
  localStorage-persistenter Warenkorb; Event-Pakete und Catering-Artikel dürfen nicht gemischt werden (Korb wird mit Hinweis geleert); GA4-Tracking für add/remove; Berührungspunkt: Bestellungen landen als catering_orders im MAESTRO.  
  _Evidenz: `src/contexts/CartContext.tsx`_
- **Kundenkonto mit Profil** · 🟠 regelmäßig  
  Registrierung/Login für Kunden mit Profil (Liefer- und Rechnungsadresse, Stockwerk, Aufzug) — Daten fließen in Catering-Bestellungen ein, die im Backoffice erscheinen.  
  _Evidenz: `src/contexts/CustomerAuthContext.tsx, src/hooks/useCustomerAuth.ts`_
- **Brutto/Netto-Preisumschalter mit 70/30-Split** · 🟠 regelmäßig  
  Preisanzeige umschaltbar brutto/netto; Pakete mit Speisen+Getränken werden nach BMF-Vereinfachungsregel 70% Speisen (7%) / 30% Getränke (19%) aufgeteilt.  
  _Evidenz: `src/contexts/PriceDisplayContext.tsx`_
- **Cookie-Consent mit Google Consent Mode v2** · ⚙️ intern  
  Consent-Banner mit Kategorien (Statistik, Marketing, extern), 365 Tage Gültigkeit, Versions-Invalidierung und automatischem Page-Reload bei Widerruf, um externe Skripte zu entladen.  
  _Evidenz: `src/contexts/CookieConsentContext.tsx`_
- **Zweisprachigkeit DE/EN über URL-Pfade** · ⚙️ intern  
  Sprachumschaltung navigiert zur übersetzten URL (hreflang-Paare); Admin-Routen bleiben sprachneutral; Hilfs-Hook für lokalisierte Links inkl. Hash-Fragmente.  
  _Evidenz: `src/contexts/LanguageContext.tsx, src/hooks/useLocalizedPath.ts`_
- **Öffentliche Speisekarten mit SSG-Hydration** · ⚙️ intern  
  Veröffentlichte Catering-Menüs werden aus statischem JSON (Build-Zeit) sofort gerendert und clientseitig mit frischen DB-Daten überschrieben; SSG-Signal 'prerender-ready' für den Pre-Renderer.  
  _Evidenz: `src/hooks/useCateringMenus.ts (usePublishedCateringMenus), src/hooks/usePrerenderReady.ts`_
- **KI-Wissensbasis-Aufbereitung mit Risiko-Filter** · ⚙️ intern  
  Zerteilt Website-Texte in 800-1500-Zeichen-Chunks für die KI-Wissensbasis und markiert Preis-/Rechtsinhalte (AGB, Storno, MwSt, Lieferkosten) als riskant, damit die KI sie nicht als Antwortquelle nutzt.  
  _Evidenz: `src/lib/knowledge/chunkText.ts, src/lib/knowledge/riskClassifyKnowledge.ts`_

## Speisekarten (7)

- **Catering-Menü-Verwaltung (CRUD, zweisprachig)** · 🟠 regelmäßig  
  Menüs, Kategorien und Artikel anlegen/bearbeiten/löschen mit DE/EN-Feldern, Preisen (Zahl oder Freitext), Portionsinfos, Mindestbestellmenge, vegetarisch/vegan-Flags und Artikelbildern; Veröffentlichen/Verbergen pro Menü.  
  _Evidenz: `src/hooks/useCateringMenus.ts, src/hooks/useCateringMenuMutations.ts`_
- **Papierkorb mit 60-Tage-Wiederherstellung** · 🟡 selten  
  Gelöschte Artikel/Kategorien landen im Soft-Delete-Papierkorb mit Restlaufzeit-Anzeige und können wiederhergestellt werden; nach 60 Tagen automatische endgültige Löschung (clientseitiger Fallback-Purge), zusätzlich manuelles endgültiges Löschen.  
  _Evidenz: `src/hooks/useCateringMenuMutations.ts (useMenuTrash, useRestore*, usePermanentDelete*)`_
- **Saisonales Archiv für Artikel/Kategorien** · 🟠 regelmäßig  
  Artikel oder ganze Kategorien saisonal ausblenden (archivieren) ohne Löschung und später wieder aktivieren — getrennt vom Papierkorb.  
  _Evidenz: `src/hooks/useCateringMenuMutations.ts (useArchive*/useUnarchive*, useMenuArchive)`_
- **KI-Übersetzung von Menütexten** · 🟠 regelmäßig  
  Übersetzt Artikelname und Beschreibung per Edge Function (translate-menu-text) automatisch DE→EN.  
  _Evidenz: `src/hooks/useTranslateMenuText.ts`_
- **Restaurant-Speisekarten-Import (Ristorante-DB)** · 🟠 regelmäßig  
  Lädt die Speise-, Mittags- und Getränkekarten sowie Degustationsmenüs des Restaurants aus einer zweiten Datenbank via Edge Functions (fetch-ristorante-menus / -complete-menus) — für Angebotserstellung und Menüauswahl.  
  _Evidenz: `src/hooks/useRistoranteMenus.ts, src/hooks/useRistoranteCompleteMenus.ts`_
- **Kombinierte Artikelsuche Catering + Restaurant** · 🔴 täglich  
  Führt Catering-Artikel und Restaurant-Gerichte/Getränke zu einer durchsuchbaren Gesamtliste zusammen (inkl. Preis-Parsing aus Freitext '14,50 €') — Basis für den Angebots-Builder.  
  _Evidenz: `src/hooks/useCombinedMenuItems.ts`_
- **Paket-Gänge-Konfiguration und Vollständigkeitsprüfung** · ⚙️ intern  
  Lädt für alle Pakete die konfigurierten Pflicht-Gänge (package_course_config), um Menü-Vollständigkeit im Editor prüfen zu können.  
  _Evidenz: `src/hooks/useAllPackageCourseConfigs.ts`_

## System (6)

- **System-Health-Monitor** · 🟡 selten  
  Live-Fehlerliste (Supabase Realtime) fuer beide Projekte (events-storia.de, ristorantestoria.de) mit Schweregrad, geloest-Markierung inkl. Notiz, Filter 'geloeste anzeigen'; taeglicher Audit manuell ausloesbar (Edge-Function, optional E-Mail-Report) mit Historie der letzten Laeufe.  
  _Evidenz: `/home/user/events-storia.de/src/pages/admin/SystemHealth.tsx (Route /admin/system-health)`_
- **Fehler-Monitoring & Health-Audit (system_errors, daily_audits, system_health_audit_runs)** · ⚙️ intern  
  Frontend-/Backend-Fehler werden dedupliziert gesammelt (report_frontend_error-RPC, Zähler, Resolve-Workflow, Eskalation); täglicher Audit mit Severity-Score und Status-Mail ans Team.  
  _Evidenz: `supabase/migrations/20260515205529, 20260516113922`_
- **DSGVO-Datenlöschung (data_retention_policies, data_purge_audit)** · 🟡 selten  
  Konfigurierbare Aufbewahrungsfristen pro Datenbereich (Soft-/Hard-Delete nach X Tagen, Dry-Run, Batch-Limit) mit Kandidaten-Views (v_purge_candidates_*) und vollständigem Lösch-Audit.  
  _Evidenz: `supabase/migrations/20260624132809_cabec3cd-f6a9-47af-a646-962c0e2e744d.sql`_
- **Legacy-Kompatibilitätsschicht (Views + INSTEAD-OF-Trigger)** · ⚙️ intern  
  Alte Tabellennamen (event_inquiries, catering_orders, event_payments, inquiry_tasks, email_messages, customer_profiles, ...) existieren als Views auf den v2-Spine mit INSTEAD-OF-Triggern; die _legacy_*-Tabellen sind noch vorhanden, aber gesperrt (RLS-Lockdown, aus Realtime entfernt).  
  _Evidenz: `supabase/migrations/20260422212017, 20260422220451, 20260624105928`_
- **E-Mail-Testschutz (Test-Safety-Umleitung)** · ⚙️ intern  
  Bei Vorgaengen mit is_test=true werden alle Kundenmails serverseitig auf eine sichere interne Adresse umgeleitet und der Betreff mit [TEST] geprefixt — verhindert Testmails an echte Kunden.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/_shared/test-safety.ts, /home/user/events-storia.de/docs/lovable-prompt-email-safety.md`_
- **Separate Admin-Shell-HTML (kein Prerender-Flash)** · ⚙️ intern  
  Post-Build-Skript erzeugt ein eigenes dist/admin/index.html ohne vorgerenderten Website-Inhalt, damit das Backoffice ohne 'Homepage-Flash' laedt und noindex/nofollow traegt.  
  _Evidenz: `/home/user/events-storia.de/scripts/generate-admin-html.ts`_

## Fotoalbum (6)

- **Foto-Verwaltung** · 🟡 selten  
  Fotoalbum-Bereich (/admin/fotos): Fotos per Drag&Drop hochladen, Bild-Auswahl-Dialog mit Suche nach Name/Titel/Tag zur Verknüpfung mit Speisen/Paketen.  
  _Evidenz: `src/components/admin/PhotoDropzone.tsx, PhotoPickerDialog.tsx, AdminLayout.tsx (Nav 'Fotoalbum')`_
- **Foto-Bibliothek mit Filtern und Realtime** · 🟠 regelmäßig  
  Zentrale Fotoverwaltung mit Filter nach Kategorie/Tags/Archiv; privater Storage-Bucket mit automatisch erzeugten signierten URLs (1h); Realtime-Aktualisierung bei jeder Änderung.  
  _Evidenz: `src/hooks/usePhotoAlbum.ts`_
- **Upload mit automatischer WebP-Optimierung** · 🟠 regelmäßig  
  Bilder werden vor dem Upload clientseitig auf max. 1920px skaliert und als WebP (Qualität 0.82) komprimiert, mit Fallback auf Original bei alten Browsern.  
  _Evidenz: `src/hooks/usePhotoAlbum.ts (useUploadPhoto), src/lib/convertToWebp.ts`_
- **KI-Bildklassifizierung** · 🟠 regelmäßig  
  Nach dem Upload klassifiziert eine Edge Function (classify-photo) das Bild automatisch in Kategorien (Pizza, Pasta, Fleisch, Ambiente, Team ...) mit Konfidenz; manuelle Re-Klassifizierung möglich; Ergebnis erscheint per Realtime.  
  _Evidenz: `src/hooks/usePhotoAlbum.ts (useReclassifyPhoto), src/lib/photoAlbumVocabulary.ts`_
- **Foto-Versionierung mit Versionsstapeln** · 🟡 selten  
  Neue Bildversionen zu einem bestehenden Foto hochladen, mehrere Fotos nachträglich als Versionen zusammenfassen, aktuelle Version wählen; Grid zeigt Stapel-Indikator mit Versionsanzahl.  
  _Evidenz: `src/hooks/usePhotoAlbum.ts (usePhotoVersions, useAssignAsVersions, useSetCurrentVersion, usePhotoVersionCounts)`_
- **Metadaten, Bulk-Aktionen und Ordner** · 🟠 regelmäßig  
  Titel/Beschreibung/Kategorie/Tags bearbeiten, Fotos einzeln oder gebündelt archivieren/löschen; farbige Ordner mit Mehrfach-Zuordnung pro Foto (anlegen, umbenennen, löschen, Mitgliedschaft exakt setzen), Realtime-Sync.  
  _Evidenz: `src/hooks/usePhotoAlbum.ts, src/hooks/usePhotoFolders.ts`_

## Website-Berührungspunkte (6)

- **Website-Checkout (checkout_create_event_booking / _catering_order)** · 🔴 täglich  
  Anon-RPCs, über die die öffentliche Website Event-Buchungen und Catering-Bestellungen sicher anlegt (SECURITY DEFINER statt offener Insert-Policies); 'Anyone can insert v2_events' für Anfrage-Formulare.  
  _Evidenz: `supabase/migrations/20260509180114, 20260515203611, 20260205000000_event_bookings_public_insert.sql`_
- **Lead-Funnel der Website (leads_funnel)** · 🟠 regelmäßig  
  Mehrstufiges Anfrage-Formular (Intent inhouse/delivery/consult, Anlass, Personen-Bucket, Datums-Modus, Kontakt) mit DSGVO-Consent, Lead-Score 0–100, Status-Pipeline (new→converted/lost), UTM-Tracking und Benachrichtigungs-Fehlerprotokoll (lead_notify_failures: Auto-Reply, interne Mail, Slack).  
  _Evidenz: `supabase/migrations/20260514153752_5d2a4fb6-ece3-4489-88d8-53d3fbb5e32c.sql`_
- **KI-Intake-Chat (ai_conversations/messages/extractions)** · 🟠 regelmäßig  
  Website-Chat ('AI Intake Bar') mit Nachrichtenverlauf, automatischer Datenextraktion (extracted JSONB, missing_fields, confidence) zur Anfrage-Erzeugung und Datei-Uploads der Kunden (inquiry_attachments).  
  _Evidenz: `supabase/migrations/20260615124240_7d956d7e-5c2c-4200-a629-0fe1ab6e6a32.sql`_
- **Wissensbasis für KI (knowledge_sources/documents/chunks)** · ⚙️ intern  
  Indexierte Inhalte mit Chunking und Embeddings (RAG) als Antwortgrundlage des KI-Assistenten; Quellen mit Re-Index-Status.  
  _Evidenz: `supabase/migrations/20260615124240`_
- **Reisegruppen-Anfragen (group_inquiries, Legacy)** · 🟡 selten  
  Anfragen von ristorantestoria.de/reisegruppen mit Gruppengröße, flexiblem Wunschtermin, Menüwunsch, Reiseplan-Upload, UTM-Feldern und eigener Status-Pipeline; seit 2026-05 als _legacy_group_inquiries stillgelegt/gesperrt.  
  _Evidenz: `supabase/migrations/20260408195641, 20260512131955, 20260513180936 (RENAME)`_
- **Kundenkonto-Profil (customer_profiles, Legacy-View)** · 🟡 selten  
  Bei Website-Registrierung legt Trigger handle_new_customer automatisch ein Profil mit Standard-Liefer-/Rechnungsadresse an; heute View auf v2_customers.  
  _Evidenz: `supabase/migrations/20251205221357, 20260422212017 (View + Trigger)`_

## Event-Anfragen (5)

- **Anfragen-Liste (Tabelle)** · 🔴 täglich  
  Liste aller Event-Anfragen mit Filter-Pills (Eingang, Meine, Dringend, Bestaetigt, Abgelehnt, Archiv, Alle), Sortierung, Suche, Statusbadges (Neu/In Bearbeitung/Angebot verschickt/Kunde antwortete), Zahlungsstatus-Icons, Prioritaet, Zuweisungs-Avatar, Art-Chip (Im Haus/Ausser Haus/Reisegruppe), Mobile-Kartenansicht.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/EventsList.tsx`_
- **Kanban-Pipeline** · 🔴 täglich  
  Alternative Pipeline-Ansicht mit Spalten Neu / In Bearbeitung / Angebot verschickt / Gebucht (+ Archiv: Abgelehnt, Abgesagt). Karten mit Inaktivitaets-Label, Betrag, Statuswechsel und Archivieren per Dropdown. Auch Buchungen ohne Quell-Anfrage erscheinen als Gebucht-Karten. Ansicht wird in localStorage gemerkt.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/KanbanView.tsx, EventsList.tsx (viewMode)`_
- **Bulk-Aktionen** · 🟠 regelmäßig  
  Mehrfachauswahl in der Liste: Status setzen (kontaktiert), an Teammitglied zuweisen (feste Teamliste), Prioritaet (Dringend/Hoch/Normal), Archivieren/Wiederherstellen, als Test/Echt markieren.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/shared/BulkActionBar.tsx`_
- **Neue Anfrage anlegen (KI-Intake-Wizard)** · 🔴 täglich  
  2-Schritt-Wizard: (1) Freitext/Kundenmail einfuegen, KI parst Kontakt-, Event- und Programmdaten (parse-freeform-offer), (2) Kontakt- und Eventdetails pruefen. Danach Weiterleitung in den vollen Editor; KI-geparstes Freitext-Programm wird uebergeben.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/OfferCreate/index.tsx, AISuggestionsCard.tsx`_
- **Druck 'Naechste Auftraege'** · 🟠 regelmäßig  
  PDF-Report kommender Auftraege (4 Wochen / 3 Monate), gruppiert nach Woche/Monat, Filter Im-Haus/Ausser-Haus/beide, optional inkl. offener Anfragen; Vorschau, Druck und Download.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/print/UpcomingOrdersPrintDialog.tsx, UpcomingOrdersSheet.tsx`_

## Auswertung (5)

- **Conversion-Dashboard 'Warum nicht gebucht?'** · 🟠 regelmäßig  
  Zeitraumwahl (30d/90d/12m/YTD/gesamt), KPI-Karten (u.a. Umsatz, Reaktionszeit, Abschlussquote), Funnel-Balken vom Eingang bis zur Buchung sowie Diagnose-Sektion mit Leak-Karten und Liste verlorener Anfragen.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/ConversionDashboard.tsx, diagnostics/DiagnosticsSection.tsx (Route /admin/auswertung)`_
- **Conversion-Dashboard 'Warum nicht gebucht?'** · 🟠 regelmäßig  
  Auswertungsseite mit Zeitraumwahl, KPI-Reihe (u.a. Umsatz fix), Buchungs-Funnel, Conversion nach Kanal und nach Mitarbeiter.  
  _Evidenz: `src/components/admin/refine/ConversionDashboard.tsx`_
- **Conversion-Leck-Diagnose** · 🟡 selten  
  Deterministischer Klartext-Befund ('X Anfragen rein, Y gebucht, größter Hebel: …'), Leak-Karten mit Empfehlung und Liste verlorener/feststeckender Anfragen inkl. entgangenem Umsatz.  
  _Evidenz: `src/components/admin/refine/diagnostics/DiagnosticsSection.tsx, LeakCard.tsx, LostInquiryRow.tsx`_
- **Conversion-Funnel Anfrage→Buchung** · 🟠 regelmäßig  
  Vollständiger Funnel (Anfrage, Angebot verschickt, geöffnet, gebucht, bezahlt, durchgeführt) mit Schritt- und Gesamtraten, Verlustgründen, Breakdown nach Quelle und Mitarbeiter, Bearbeitungszeiten (Ø/Median Tage bis Angebot) und Umsatzkennzahlen. Enthält 'Loss-Inbox' zum Nachtragen fehlender Verlustgründe.  
  _Evidenz: `src/hooks/useConversionData.ts`_
- **Diagnose-Engine: Warum ging der Deal verloren?** · 🟠 regelmäßig  
  Ordnet jeder verlorenen oder festhängenden Anfrage deterministisch einen Primärbefund zu (nie beantwortet, zu langsam, Angebot nie geöffnet, Interesse verpufft, Preis, Termin) und rollt sie zu 'Lecks' mit entgangenem Umsatz (gesichert vs. geschätzt über Ø-Bestellwert/Gast) und festen Handlungsempfehlungen hoch; dazu Segmentmuster nach Anlass und Gästezahl-Bucket.  
  _Evidenz: `src/hooks/useInquiryDiagnostics.ts`_

## Anfragen/Listen (5)

- **Vereinheitlichte Anfragen-Liste (Events + Catering + Restaurant)** · 🔴 täglich  
  Zentrale Inbox mit Tabs (Inbox/Gewonnen/Erledigt/Archiv), umschaltbar zwischen Tabellen- und Kanban-Ansicht (Präferenz in localStorage), Quellen-Icons (KI-Bar, Auto-Import via maestro@) und Zustellfehler-Warnungen pro Zeile.  
  _Evidenz: `src/components/admin/refine/UnifiedInquiriesList.tsx, EventsList.tsx`_
- **Kanban-Board mit Drag&Drop-Status** · 🔴 täglich  
  Anfragen/Bestellungen per Drag&Drop zwischen Status-Spalten verschieben (innerhalb eines Buckets), Karten-Aktionen (Archivieren, Status ändern), Kundenwahl-/Fehler-Badges.  
  _Evidenz: `src/components/admin/refine/UnifiedKanbanView.tsx, KanbanView.tsx, OrdersKanbanView.tsx`_
- **Bulk-Aktionen auf Mehrfachauswahl** · 🟠 regelmäßig  
  Für ausgewählte Anfragen: Status setzen (z.B. kontaktiert), Teammitglied zuweisen (fest hinterlegte Teamliste), Priorität (normal/hoch/dringend), archivieren/wiederherstellen, löschen, als Test/Echt markieren.  
  _Evidenz: `src/components/admin/shared/BulkActionBar.tsx, src/components/admin/refine/DataTable.tsx`_
- **Zahlungs-Ampeln in der Event-Liste** · 🔴 täglich  
  Pro Event-Zeile Payment-Indikator: vollständig bezahlt, teilweise bezahlt, Zahlung ausstehend, Zahlung überfällig.  
  _Evidenz: `src/components/admin/refine/EventsList.tsx`_
- **PDF-Druck 'Kommende Bestellungen'** · 🟠 regelmäßig  
  Druckdialog für kommende Events/Bestellungen: Gruppierung Woche (28 Tage) oder Monat (3 Monate), Location-Filter, optional offene Anfragen einschließen, PDF-Vorschau, Download und Drucken (client-seitig via react-pdf).  
  _Evidenz: `src/components/admin/refine/print/UpcomingOrdersPrintDialog.tsx, UpcomingOrdersSheet.tsx`_

## Menü / Katalog (5)

- **Restaurant-Speisekarten importieren** · 🟡 selten  
  Liest die Speisekarten (Menüs, Kategorien, Positionen inkl. EN-Übersetzungen, Allergene, Vegetarisch/Vegan) aus der separaten Supabase-DB von ristorantestoria.de zur Übernahme in den Catering-Katalog.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/fetch-ristorante-menus/index.ts, /home/user/events-storia.de/supabase/functions/fetch-ristorante-complete-menus/index.ts`_
- **Preis-Reparatur Restaurant-DB** · 🟡 selten  
  Einmal-Werkzeug: parst price_display-Strings in numerische Preise für Restaurant-Menüpositionen, mit Dry-Run-Vorschau.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/fix-ristorante-prices/index.ts`_
- **Menü-PDF/Text per KI parsen** · 🟡 selten  
  Wandelt einen Menü-Text per KI in eine strukturierte Karte (Titel, Kategorien, Positionen mit Preisen) inklusive englischer Übersetzung für den Import um.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/parse-menu-pdf/index.ts`_
- **KI-Übersetzung Menütexte** · 🟡 selten  
  Übersetzt einzelne Menü-Namen/-Beschreibungen per KI (Standard de zu en) für die zweisprachige Katalogpflege.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/translate-menu-text/index.ts`_
- **Paket-Menü mehrsprachig übersetzen** · 🟡 selten  
  Übersetzt das komplette Menü eines Event-Pakets per KI nach en/it/fr und speichert die Übersetzungen am Paket.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/translate-package-menu/index.ts`_

## Menü-Katalog (5)

- **Speisekarten-Verwaltung (menus, menu_categories, menu_items)** · 🟠 regelmäßig  
  Mehrere Karten (Lunch, Food, Drinks, Weihnachten, Valentinstag, Special) mit Kategorien und Gerichten, zweisprachig (DE/EN), Preisen, Allergenen, Vegetarisch/Vegan-Flags, PDF-URL, Publish-Status und Slug; Kategorien mit Bild + homepage_slug für Website-Karten.  
  _Evidenz: `supabase/migrations/20251205174913_remix_migration_from_pg_dump.sql, 20260605224200`_
- **Soft-Delete, Archiv & Auto-Purge für Speisen** · 🟠 regelmäßig  
  Gerichte/Kategorien werden erst soft-gelöscht (60 Tage wiederherstellbar, dann purge_deleted_menu_items) oder dauerhaft archiviert (saisonale Karten).  
  _Evidenz: `supabase/migrations/20260221_000002_menu_soft_delete.sql, 20260221_000003_menu_archive.sql`_
- **Event-Pakete (packages + Konfiguration)** · 🟠 regelmäßig  
  Pakete (Hochzeit, Firmenfeier, Getränke, ...) mit Preis pro Person/pauschal, Gäste-Min/Max, Inklusivleistungen, Bild (image_url), zugeordneten Menü-Items (package_menu_items), Gang-Konfiguration (package_course_config: Pflichtgänge, erlaubte Quellen/Kategorien, Custom-Items) und Getränkepaket-Konfiguration (package_drink_config: Gruppen, Auswahloptionen, Menge pro Person); Zuordnung zu Räumen (package_locations).  
  _Evidenz: `supabase/migrations/20260128201058, 20260128230539, 20260128233319, 20260630120000_packages_image_url.sql`_
- **Equipment- & Personal-Katalog** · 🟠 regelmäßig  
  equipment_catalog (Leihartikel mit Standardmenge, Einheit, Stückpreis) und staff_catalog (Personal-Positionen mit Stundensatz, Standard 4h) als Positionsquellen für Catering-Angebote.  
  _Evidenz: `supabase/migrations/20260510002231, 20260513211721`_
- **Räume/Locations (locations)** · 🟡 selten  
  Veranstaltungsräume mit Kapazität (sitzend/stehend), Ausstattungs-Features und Aktiv-Flag, zweisprachig; verknüpfbar mit Paketen und Events.  
  _Evidenz: `supabase/migrations/20260128203851`_

## Posteingang (4)

- **Zentraler E-Mail-Eingang** · 🔴 täglich  
  Eigene Seite fuer nicht zugeordnete eingehende Mails mit Ordnern Offen / Ausgeblendet / Blockiert / Entwuerfe, Split-View (Liste + Lesebereich, resizable), Suche, Tastatur-Shortcuts, Anhaenge.  
  _Evidenz: `/home/user/events-storia.de/src/pages/admin/Posteingang.tsx (Route /admin/posteingang)`_
- **KI-Zuordnungsvorschlaege** · 🔴 täglich  
  Button 'KI-Vorschlaege' analysiert alle offenen Mails (Edge-Function bulk-suggest-mappings) und schlaegt passende Anfragen mit Konfidenz (hoch/mittel/niedrig) vor; Ein-Klick-Zuordnung, bei mehreren Kandidaten Auswahldialog. Sortierung der Liste nach Vorschlags-Konfidenz.  
  _Evidenz: `/home/user/events-storia.de/src/pages/admin/Posteingang.tsx (runBulkSuggest, suggestion_category/confidence)`_
- **Mail-Aktionen: zuordnen, Anfrage anlegen, ignorieren, blockieren** · 🔴 täglich  
  Mail manuell einer bestehenden Anfrage zuordnen (Dialog mit Suche), direkt neue Anfrage aus der Mail anlegen (Datum/Gaeste erforderlich), Mail ignorieren mit optionalem Absender-Block, Absender entsperren, ausgeblendete Mails wieder einblenden.  
  _Evidenz: `/home/user/events-storia.de/src/pages/admin/Posteingang.tsx (Dialoge Zuordnen/Neue Anfrage/Ignorieren, Blocklist)`_
- **E-Mail-Entwuerfe** · 🟠 regelmäßig  
  Entwuerfe-Ordner: gespeicherte Mail-Entwuerfe ansehen, im Composer bearbeiten, versenden oder loeschen.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/posteingang/DraftsView.tsx`_

## Angebot (Versand) (4)

- **Zweistufiger Angebotsversand mit Versionierung** · 🔴 täglich  
  Vorschlag ('Proposal') und finales Angebot senden; jede Sendung erzeugt einen unveränderlichen Versions-Snapshot in der Angebots-Historie; nach Versand erkennt das System lokale Änderungen und kündigt automatisch 'Version N+1' an; 'Neue Version' kann explizit entsperrt werden.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/SendControls.tsx, useOfferBuilder.ts, SmartInquiryEditor.tsx`_
- **WYSIWYG-Versand-Vorschau + Testmail** · 🔴 täglich  
  Strikt read-only Vorschauseite rendert die Mail per dryRun exakt wie beim echten Versand (inkl. LexOffice-PDF und Public-Offer-Vorschau); 'Vorschau-Mail an mich & Ristorante' sendet Testmail mit umgeleiteten Empfängern; Erfolgs-Dialog zeigt echte Empfänger und Message-ID.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferSendPreview.tsx, SendSuccessDialog.tsx`_
- **Versand-Automatiken (LexOffice, Stripe, Übersetzung)** · 🔴 täglich  
  Beim Versand automatisch: LexOffice-Angebots-PDF erzeugen/aktualisieren, bei finalem Angebot Stripe-Payment-Links pro Option erstellen, Übersetzungs-Cache leeren, History-Snapshot und Aktivitätslog schreiben — Phase-Update vor Mailversand als Abbruch-Schutz.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/useOfferBuilder.ts, SmartInquiryEditor.tsx`_
- **Angebots-Versionsarchiv** · 🟠 regelmäßig  
  Alle versendeten Versionen mit Zeit, Absender, Optionen und Summen einsehen (read-only Archiv-Ansicht identisch zum Versand-Layout) und per 'Als neues Angebot kopieren' als editierbaren Entwurf klonen; Diff-Panel zeigt geänderte Feldbereiche seit letzter gesendeter Version.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferHistoryList.tsx, OfferArchivePreview.tsx, DraftDiffPanel.tsx`_

## Zahlungen (4)

- **Zahlungsverwaltung pro Event** · 🔴 täglich  
  Liste aller Zahlungen (Anzahlung/Vorauszahlung/Endabrechnung) mit berechnetem Status (Entwurf, gesendet, bezahlt, überfällig, storniert, erstattet), Fälligkeit auch relativ zum Event ('X Tage vorher'), Zahlungslink kopieren, Erinnerungen.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/PaymentCard.tsx, PaymentStatusStrip.tsx`_
- **Zahlung anlegen mit Stripe-Link oder manuell** · 🔴 täglich  
  Drawer mit Betrag-Schnellwahl (Prozente der Angebotssumme oder 'Rest'), Fälligkeit; entweder Stripe-Checkout-Session erzeugen und Zahlungslink per Mail senden (Karte, SEPA, Billie) oder Zahlung manuell als bezahlt vermerken — optional mit automatischer Rechnung und Bestätigungsmail.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/AddPaymentDrawer.tsx`_
- **Zahlungs-Saldo-Karte für Bestellungen/Buchungen** · 🔴 täglich  
  Saldo-Übersicht (bezahlt/offen) für Catering-Bestellungen und Event-Buchungen; Zahlungslink erstellen und an Kunden senden, Zahlungsbestätigung versenden.  
  _Evidenz: `src/components/admin/shared/PaymentBalanceCard.tsx`_
- **Stripe-Checkout-Session starten** · 🟠 regelmäßig  
  Erstellt eine Stripe-Zahlungssitzung (Vollzahlung oder Anzahlung, optional mit Mengen je Angebots-Option) per direktem Fetch an die Edge Function, mit verständlichen deutschen Fehlermeldungen.  
  _Evidenz: `src/lib/createPaymentSession.ts`_

## Kunden (4)

- **Kundenkonto-Einladung** · 🟠 regelmäßig  
  Kunden per Knopfdruck ein Konto-Einladungs-Mail senden (mit Duplikat-Erkennung 'hat bereits ein Konto').  
  _Evidenz: `src/components/admin/shared/InviteCustomerAccountButton.tsx, InviteCustomerIconButton.tsx`_
- **Event-Stammdaten & Location-Erfassung** · 🔴 täglich  
  Event-DNA-Karte: Kontakt, Firma, Termin, Zeitfenster, Gästezahl, Anlass, Rechnungsadresse; Location-Block mit Auswahl Ristorante/Firmenadresse/andere Adresse inkl. OpenStreetMap-Adress-Autocomplete (Nominatim); Original-Kundenanfrage sichtbar.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/EventDNACard.tsx, LocationBlock.tsx, NominatimAutocomplete.tsx`_
- **Kunden-Anhänge einsehen** · 🟠 regelmäßig  
  Vom Kunden über die KI-Bar hochgeladene Anhänge (Bilder/PDFs) mit Quelle, Größe und Download/Öffnen anzeigen.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/CustomerAttachmentsCard.tsx`_
- **Zentrale Kundenkartei (v2_customers)** · 🔴 täglich  
  Kundenstammdaten mit Name, Firma, E-Mail, Telefon, Adresse, internen Notizen; Dubletten-Zusammenführung (merged_into_id), Verknüpfung zu Lexoffice-Kontakt und Website-Login (auth_user_id).  
  _Evidenz: `supabase/migrations/20260422202324_a411adcd-d848-43e0-b3f8-1d2b08465cf3.sql`_

## Website (Berührungspunkte) (4)

- **KI-Intake-Bar für Kundenanfragen** · 🔴 täglich  
  Öffentliche Chat-Bar (DE/EN/IT/FR): Kunde beschreibt sein Catering, KI stellt Rückfragen, extrahiert strukturierte Daten (Zusammenfassungs-Karte), erlaubt Anhänge und sendet die Anfrage an STORIA — landet als 'Über KI-Bar angefragt' inkl. KI-Entwurf im Maestro.  
  _Evidenz: `src/components/ai/AiIntakeBar.tsx, AiSummaryCard.tsx, AiAttachmentUploader.tsx, AiChatMessages.tsx`_
- **Catering-Warenkorb & Checkout** · 🔴 täglich  
  Website-Shop mit Warenkorb (CartSheet, Sticky-Panel), Checkout mit Zeitslot-Auswahl, Zahlarten-Auswahl (Stripe), Fortschrittsanzeige und Bestell-Zusammenfassung — erzeugt die Catering-Bestellungen, die im Maestro verwaltet werden.  
  _Evidenz: `src/components/cart/*, src/components/checkout/*`_
- **Event-Paket-Anfrage & Kontaktformular** · 🔴 täglich  
  Paket-Karten mit Anfrage-Dialog und Event-Kontaktformular auf der Website — erzeugen Event-Anfragen bzw. Buchungen im Maestro; Pakete/Locations werden aus den Maestro-Stammdaten gespeist (inkl. Sichtbarkeits-Flag für ristorantestoria.de).  
  _Evidenz: `src/components/events/EventContactForm.tsx, EventPackageInquiryDialog.tsx, EventPackageShopCard.tsx`_
- **Öffentliche Angebotsseite mit Kundenwahl** · 🔴 täglich  
  Kunde sieht unter /offer/:id das versendete Angebot (übersetzt in seine Sprache), wählt eine Option und hinterlässt Anmerkungen; Wahl und Notizen erscheinen im Admin-OptionCard; Signatur (Kostenübernahme) und Stripe-Zahlung schließen sich an.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/ClientPreview.tsx, OfferBuilder/OptionCard.tsx (isCustomerChoice), useOfferBuilder.ts (customerResponse)`_

## E-Mail (Versand/Zustellung) (4)

- **Zustellstatus-Tracking (Resend-Webhook)** · ⚙️ intern  
  Verarbeitet Resend-Events (sent/bounced/complained/failed/delayed) in die Zustell-Logs; konservatives Mapping (delivered wird nur als versendet angezeigt), Fehlerstatus werden nie durch spätere Success-Events überschrieben.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/receive-resend-webhook/index.ts`_
- **Automatischer SMTP-Neuversand bei Bounce** · ⚙️ intern  
  Versendet eine ausgehende Event-Mail erneut über IONOS-SMTP, wenn Resend bounced/complained/failed/suppressed meldet; markiert den Fehler-Log als gelöst.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/resend-via-smtp/index.ts`_
- **Interne Warnung bei Mail-Zustellfehler** · ⚙️ intern  
  Schickt dem Team eine formatierte Alarm-Mail, wenn eine Kundenmail fehlschlägt (Bounce, Spam-Beschwerde, Suppression), mit Details aus dem Zustell-Log.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/notify-email-failure/index.ts`_
- **Vordefinierte Einzel-HTML-Mails versenden** · 🟡 selten  
  Versendet hartkodierte, kundenspezifische HTML-Mail-Presets (z.B. Restzahlung Rigshospitalet, Anzahlungsbestätigung CYIM) durch einen authentifizierten Admin.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-raw-html-email/index.ts`_

## Website-Berührungspunkte (Anfragen) (4)

- **Event-Anfrageformular (öffentlich)** · 🔴 täglich  
  Nimmt Anfragen vom Website-Formular entgegen, speichert sie als Inquiry, sendet dem Kunden eine Bestätigungsmail und dem Team eine interne Benachrichtigung; Versand wird geloggt.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/receive-event-inquiry/index.ts`_
- **Gruppenreservierungs-Anfrage (öffentlich)** · 🟠 regelmäßig  
  Anfrageformular für Gruppenreservierungen von ristorantestoria.de und events-storia.de (CORS-Whitelist), inkl. Wunschdatum, Gruppengröße und Ankunftszeit.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/receive-group-inquiry/index.ts`_
- **Gruppenanfragen-Import-Webhook** · 🟡 selten  
  Secret-geschützter Webhook zum Import von Gruppenanfragen aus einem Fremdsystem inkl. Status-Mapping auf Maestro-Status und optionalem Reiseplan-PDF-Upload (Base64).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/receive-group-inquiry-webhook/index.ts`_
- **Lead-Funnel mit Scoring und Auto-Reply** · 🔴 täglich  
  Bewertet neue Funnel-Leads serverseitig (Score hoch/mittel/niedrig), sendet dem Kunden eine automatische Antwort und dem Team eine priorisierte interne Mail (Betreff je nach Score); Fehler werden geloggt, Slack-Alerts sind vorbereitet.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/lead-notify-funnel/index.ts`_

## Buchungen (3)

- **Buchungsliste (bezahlte Events)** · 🔴 täglich  
  Liste bestaetigter/bezahlter Event-Buchungen mit Filtertabs Alle / Menue offen / Bereit / Abgeschlossen, Statusbadges und Paket-Anzeige.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/EventBookingsList.tsx (Route /admin/bookings)`_
- **Buchungs-Editor mit Menue-Workflow** · 🔴 täglich  
  Menue-Konfiguration je Buchung (Gaenge waehlen, Getraenkepakete, eigene Positionen, globale Speisensuche), 'Menue bestaetigen & E-Mail senden'; Buchung stornieren (mit optionaler Kundennachricht), als zurueckerstattet markieren; Event-Details, Kundendaten, interne Notizen, Aktivitaeten-Tab.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/EventBookingEditor.tsx, InquiryEditor/MenuComposer/ (MenuWorkflow.tsx, DrinkPackageSelector.tsx, FinalizePanel.tsx)`_
- **Event-Buchungen (Paket-Shop) verwalten** · 🔴 täglich  
  Buchungsliste mit Filtern (Alle / Menü offen / Bereit / Abgeschlossen); Buchungs-Editor mit Menü-Zusammenstellung im geführten Workflow (Gang-für-Gang-Auswahl, Getränkepakete, globale Artikelsuche, eigene Items), 'Menü bestätigen + Bestätigungsmail senden', Stornieren mit KI-Nachricht und 'Als zurückerstattet markieren'.  
  _Evidenz: `src/components/admin/refine/EventBookingsList.tsx, EventBookingEditor.tsx, InquiryEditor/MenuComposer/*`_

## Gutscheine (3)

- **Gutschein-Pruefung & Einloesung** · 🟠 regelmäßig  
  Seriennummer eingeben (Gross-/Kleinschreibung egal), Gutschein-Details mit Status/Ablauf anzeigen, als eingeloest markieren (nur bezahlte), Einloesung zuruecksetzen; Liste der letzten Gutscheine mit Statistik (aktiv/eingeloest/ausstehend).  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/VouchersList.tsx (Route /admin/gutscheine)`_
- **Gutschein-Verwaltung** · 🟠 regelmäßig  
  Gutscheine suchen (Code), Details einsehen (Käufer, Empfänger, Nachricht, Gültigkeit, PDF), als eingelöst markieren und Einlösung zurücksetzen; Status ausstehend/bezahlt/eingelöst/storniert.  
  _Evidenz: `src/components/admin/refine/VouchersList.tsx`_
- **Gutschein-PDF-Erzeugung (personalisiert, DE/EN)** · 🟠 regelmäßig  
  Beim Gutscheinkauf wird serverseitig ein PDF mit Code, Betrag, Gueltigkeitsdatum, Empfaenger-/Kaeufername und persoenlicher Nachricht erzeugt (pdf-lib) und dem Kunden zugestellt.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/_shared/voucher-pdf.ts`_

## Angebot (Kunde) (3)

- **Kundenwahl-Anzeige im Editor** · 🔴 täglich  
  Wählt der Kunde auf der öffentlichen Angebotsseite eine Option, wird sie im Editor als 'Kundenwahl' mit Zeitstempel markiert; Anmerkungen des Kunden sind aufklappbar sichtbar.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/OfferBuilder/OptionCard.tsx (isCustomerChoice, customerNotes)`_
- **Kunden-Ansicht öffnen (Public Offer)** · 🔴 täglich  
  Direkt aus dem Editor die öffentliche Angebotsseite /offer/:id in Kundenperspektive öffnen (mit Versionsanzeige).  
  _Evidenz: `src/components/admin/refine/InquiryEditor/ClientPreview.tsx`_
- **Kundensprache wechseln mit KI-Übersetzung** · 🟠 regelmäßig  
  Sprache DE/EN/IT/FR pro Kunde; Dialog erlaubt selektive Übersetzung von Anschreiben, Kundennachricht, Menü und Paketbeschreibung; Übersetzungs-Cache wird verwaltet; mehrsprachige Labels für Gänge/Getränke aus der Paketkonfiguration.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/CustomerLanguageSelector.tsx, LanguageSwitchDialog.tsx, SmartInquiryEditor.tsx`_

## Website-Berührungspunkte (Zahlung) (3)

- **Restzahlungs-Checkout (öffentlich)** · 🟠 regelmäßig  
  Die öffentliche Restzahlungsseite startet darüber den Stripe-Checkout: validiert Slug und Gästezahl gegen den hinterlegten Link und berechnet den Betrag serverseitig.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-balance-checkout/index.ts`_
- **Shop-Checkout (Catering-Bestellung)** · 🔴 täglich  
  Erzeugt die Stripe-Checkout-Session für Bestellungen aus dem öffentlichen Catering-Shop (Warenkorb, Kundendaten, Zahlungsmethode).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-catering-payment/index.ts`_
- **Gutschein-Kauf** · 🟠 regelmäßig  
  Verkauf von STORIA-Gutscheinen über Stripe (10-500 EUR, Gültigkeit 3 Kalenderjahre nach BGB, Empfänger + persönliche Nachricht, de/en); nach Zahlung erzeugt der Webhook Gutschein-Code, PDF und Versand-Mail.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/create-voucher-checkout/index.ts, /home/user/events-storia.de/supabase/functions/_shared/voucher-pdf.ts`_

## System / Monitoring (3)

- **Checkout-Fehler-Alarm** · ⚙️ intern  
  Meldet Client-Fehler im Website-Checkout sofort per Mail ans Team und loggt sie als critical in den System-Health-Hub (Warenkorb, Zahlart, Zeitpunkt).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/notify-checkout-error/index.ts`_
- **Zentraler Error-Hub** · ⚙️ intern  
  Nimmt Fehlermeldungen beider Projekte (events-storia.de und ristorantestoria.de) Secret-geschützt entgegen, dedupliziert per Hash und zählt Wiederholungen — Basis für das System-Health-Dashboard.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/report-system-error/index.ts, /home/user/events-storia.de/supabase/functions/_shared/reportError.ts`_
- **Täglicher System-Health-Audit** · ⚙️ intern  
  Cron-Report über beide Projekte: neue kritische Fehler (24h), eskalierende Fehler (>10 Vorkommen), alte ungelöste kritische Fehler und Top-Fehler nach Häufigkeit — als Mail an info@events-storia.de.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/system-health-daily-audit/index.ts`_

## System / Infrastruktur (3)

- **E-Mail-Versand mit Provider-Fallback** · ⚙️ intern  
  Gemeinsame Versandschicht: primär Resend, automatischer Fallback auf IONOS-SMTP; dazu Testmodus-Sicherung, die in Nicht-Produktivumgebungen alle Kundenmails auf eine sichere Adresse umleitet und Betreffs markiert.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/_shared/email-sender.ts, /home/user/events-storia.de/supabase/functions/_shared/test-safety.ts`_
- **Mehrsprachigkeit der Kundenkommunikation** · ⚙️ intern  
  Gemeinsame i18n-Schicht: erkennt die Kundensprache (de/en/it/fr), erzeugt zweisprachige Betreffzeilen und lokalisierte Datums-/Währungsformate für alle Kundenmails.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/_shared/customer-language.ts, /home/user/events-storia.de/supabase/functions/_shared/email-i18n.ts`_
- **Mandantenfähigkeit (vorbereitet)** · ⚙️ intern  
  Gemeinsames Tenant-Modul mit Default-Mandant (Storia/Speranza GmbH) und mandantenspezifischen Absendern — Grundlage für Multi-Tenant-Betrieb (Phase 4b).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/_shared/tenant.ts`_

## Buchhaltung (2)

- **Angebote-Liste (LexOffice)** · 🟠 regelmäßig  
  Alle LexOffice-Angebote (Quotations) mit Statusfilter (Alle/Offen), PDF-Vorschau im Dialog, PDF-Download und Direktlink in LexOffice; Filter 'nur Maestro-Vorgaenge'.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/LexOfficeInvoicesList.tsx mode=quotations (Route /admin/quotations)`_
- **Rechnungs-Liste mit Zahlungssync** · 🔴 täglich  
  LexOffice-Rechnungen und Gutschriften mit Typ-Filter (Rechnungen/Gutschriften) und Statusfilter (Offen/Bezahlt/Ueberfaellig); Button synchronisiert Zahlungsstatus aus LexOffice; manuelle Rechnung ueber Dialog erstellen; PDF-Vorschau/Download/LexOffice-Link.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/LexOfficeInvoicesList.tsx mode=invoices, CreateManualInvoiceDialog.tsx (Route /admin/invoices)`_

## Verträge/eSign (2)

- **Digitale Kostenübernahme (eSignatures.com)** · 🟠 regelmäßig  
  Kostenübernahme-Dokument per E-Mail zur Signatur senden (auch erneut), Status-Tracking (Entwurf → versendet → geöffnet → unterschrieben / abgelehnt / abgelaufen), signiertes PDF herunterladen, zurückziehen mit Bestätigungsdialog, Audit-Trail-Drawer; Template erstellen/synchronisieren und Integrations-Status (API-Key, Webhook) prüfen.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/CostAcceptanceCard.tsx, CostAcceptanceAuditDrawer.tsx`_
- **Signatur-Lock des Angebots** · 🟠 regelmäßig  
  Nach unterschriebener Kostenübernahme werden Optionen, Preise, Menü, Zahlungskonditionen und Send-Buttons gesperrt; Änderungen erfordern explizit eine neue Angebotsversion und neue Kostenübernahme (Banner erklärt dies).  
  _Evidenz: `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx, OfferBuilder.tsx (isSignatureLocked)`_

## KI-Features (2)

- **KI-Storno-/Absage-Assistent** · 🟠 regelmäßig  
  Wiederverwendbarer Storno-Dialog erzeugt per KI eine höfliche Absage-/Storno-Nachricht an den Kunden, frei editierbar vor Versand; genutzt bei Bestellungen und Buchungen inkl. Rückerstattungs-Hinweis.  
  _Evidenz: `src/components/admin/shared/CancellationDialog.tsx`_
- **KI-Catering-Vorschlag in den Warenkorb** · 🟠 regelmäßig  
  Für Catering-Anfragen füllt ein KI-Vorschlag (generate-menu-suggestion, Modus catering) den Positions-Warenkorb der Anfrage direkt mit passenden Artikeln.  
  _Evidenz: `src/components/admin/refine/InquiryEditor/SmartInquiryEditor.tsx (handleGenerateCateringSuggestion), CateringModules.tsx`_

## Website-Berührungspunkte (KI-Chat) (2)

- **KI-Catering-Assistent (öffentlicher Chat)** · 🟠 regelmäßig  
  Öffentlicher Chat-Assistent (Gemini 3 Flash) für FAQ aus der Knowledge Base und geführte Catering-Anfragen: extrahiert Pflichtfelder, baut einen Live-Angebotsentwurf mit echten Katalogpreisen und übergibt die fertige Anfrage an die Inquiry-Erstellung.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/ai-catering-assistant/index.ts`_
- **Datei-Upload im KI-Chat** · 🟠 regelmäßig  
  Erzeugt signierte Upload-URLs für Anhänge in der Chat-Anfrage (max. 10 Dateien, 15 MB/Datei, Whitelist JPG/PNG/WebP/PDF/DOC, Rate-Limit pro Konversation).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/ai-intake-upload-url/index.ts`_

## KI-Assistent (Admin) (2)

- **Anhang-Download für Anfrage-Anhänge** · 🟠 regelmäßig  
  Erzeugt kurzlebige (60 s) signierte Download-Links für Chat-/Anfrage-Anhänge im privaten Bucket für berechtigte Nutzer.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/ai-intake-signed-download/index.ts`_
- **Knowledge Base aus Website-Repo indexieren** · 🟡 selten  
  Admin-Funktion: re-indexiert die öffentlichen Website-Inhalte aus dem GitHub-Repo in die Knowledge Base (Chunks mit Hashes); kritische Inhalte (Preise, AGB, Rechtliches) werden auf pending_review gesetzt und nie ungereviewt an die KI ausgegeben.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/knowledge-index-github/index.ts`_

## Website-Berührungspunkte (Angebotsseite) (2)

- **Anschreiben-Übersetzung auf Angebotsseite** · 🟠 regelmäßig  
  Übersetzt das Angebots-Anschreiben on-demand in en/it/fr für die öffentliche Angebotsseite und cached das Ergebnis am Event (jsonb).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/translate-offer-letter/index.ts`_
- **Angebots-PDF-Download (öffentlich)** · 🟠 regelmäßig  
  Erlaubt dem Kunden den Download des LexOffice-Angebots-PDF von der öffentlichen Angebotsseite ohne Login (nur per Inquiry-UUID), mit Retry bei LexOffice-Rate-Limits.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/download-public-offer-pdf/index.ts`_

## Benachrichtigungen (2)

- **WhatsApp-Alerts ans Team** · 🔴 täglich  
  Sendet WhatsApp-Nachrichten über die Meta Cloud API bei neuen Bestellungen, neuen Anfragen, fehlgeschlagenem Mailversand und überfälligen Zahlungen (mit Direktlink ins Admin-Panel).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-whatsapp-alert/index.ts`_
- **In-App-Benachrichtigungszentrale** · 🔴 täglich  
  Aggregiert clientseitig: neue Anfragen (24h), mir zugewiesene Anfragen, Kommentare zu meinen Anfragen, heute fällige und überfällige Aufgaben — mit Ungelesen-Zähler, 'alle gelesen', Deep-Links; Polling jede Minute. Gelesen-Status liegt nur in localStorage (pro Gerät).  
  _Evidenz: `src/hooks/useNotifications.ts`_

## Nutzer & Kunden (2)

- **Team-Nutzerverwaltung** · 🟡 selten  
  Admin verwaltet Backoffice-Nutzer: auflisten, einladen (Konto anlegen), Rolle ändern (admin/staff), deaktivieren/aktivieren, Passwort zurücksetzen — mandantengeschützt.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/manage-users/index.ts`_
- **Kundenkonto-Einladung** · 🟡 selten  
  Admin lädt einen Kunden per E-Mail zu einem Kundenkonto/Portal ein und verknüpft es mit dem bestehenden Kundendatensatz.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/invite-customer-account/index.ts`_

## Fotos / Galerie (2)

- **KI-Fotoklassifizierung** · 🟡 selten  
  Klassifiziert Fotos des Fotoalbums per Vision-KI (Gemini 2.5 Pro, Fallback Flash): eine Kategorie (Pizza, Pasta, Ambiente, Team ...), 1-5 Tags und eine Bildbeschreibung als SEO-Alt-Text.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/classify-photo/index.ts`_
- **Batch-Reklassifizierung Fotoalbum** · 🟡 selten  
  Lässt alle (oder gefilterte) Fotos des Albums in kleinen Parallel-Batches neu klassifizieren (Admin/Staff).  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/reclassify-photos/index.ts`_

## SEO (2)

- **IndexNow-URL-Einreichung** · 🟡 selten  
  Reicht Website-URLs bei IndexNow (Bing & Co.) zur schnelleren Indexierung ein.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/submit-indexnow/index.ts`_
- **Sitemap-Generierung im Build** · ⚙️ intern  
  Build-Skript erzeugt die XML-Sitemap der Website automatisch (Grundlage fuer IndexNow/GSC-Einreichung).  
  _Evidenz: `/home/user/events-storia.de/scripts/generate-sitemap.ts`_

## Fotos (2)

- **Foto-Bibliothek mit KI-Klassifikation (photo_album)** · 🟡 selten  
  Zentrale Bildverwaltung (Storage-Pfad, Maße, Dateigröße) mit KI-Kategorisierung/Tags inkl. Konfidenz, Titel/Beschreibung, Archiv-Flag, Herkunfts-Deduplizierung und Bild-Versionierung (parent_photo_id, version, is_current).  
  _Evidenz: `supabase/migrations/20260605173700, 20260605191745, 20260605213515`_
- **Foto-Ordner (photo_folders / photo_folder_items)** · 🟡 selten  
  Farbige, sortierbare Ordner zum Organisieren der Fotobibliothek (n:m-Zuordnung).  
  _Evidenz: `supabase/migrations/20260629102740, 20260629120000_photo_folders.sql`_

## Pakete & Preise (2)

- **Event-Pakete, Reisegruppen-Pakete und Locations** · 🟠 regelmäßig  
  Lädt aktive Event-Pakete, für die Website sichtbare Gruppenreisen-Pakete und Event-Locations mit Kapazitäten und Ausstattung.  
  _Evidenz: `src/hooks/useEventPackages.ts`_
- **Staffelpreis 'Gesamte Location'** · ⚙️ intern  
  Automatische Preisberechnung: 8.500 € Basispreis bis 70 Gäste, danach 121,43 € je zusätzlichem Gast; inkl. Aufschlüsselung für die Anzeige und effektivem Stückpreis für den Warenkorb.  
  _Evidenz: `src/lib/eventPricing.ts`_

## Vorlagen (1)

- **E-Mail-Vorlagen & Textbausteine verwalten** · 🟠 regelmäßig  
  CRUD für Vorlagen (komplette Anschreiben) und Textbausteine (anhängbare Blöcke) mit Betreff, Kategorie, klickbaren Variablen und Aktiv/Inaktiv-Schalter; zusätzlich E-Mail-Signatur-Editor.  
  _Evidenz: `src/components/admin/refine/Settings.tsx (TemplateManager, SignatureEditor)`_

## Aktivitäten (1)

- **Aktivitäten-Timeline** · 🔴 täglich  
  Chronologische Timeline pro Vorgang: Statuswechsel, Feldänderungen (gruppiert nach Adresse/Termin/Gäste/Zahlung …), versendete E-Mails mit Zustellstatus, Zahlungen und Angebotsversionen; Filter (Alle/Angebote/E-Mails/Änderungen); Version ansehen/klonen; Deep-Links zu Resend- und Stripe-Dashboards.  
  _Evidenz: `src/components/admin/shared/Timeline.tsx, ExternalRefLinks.tsx`_

## Zusammenarbeit (1)

- **Zuweisung, Priorität & Präsenz** · 🔴 täglich  
  Anfragen an Teammitglieder zuweisen (Suche), Priorität setzen (normal/hoch/dringend); Präsenz-/Editor-Indikator zeigt, wer den Vorgang gerade offen hat (Kollisionsschutz).  
  _Evidenz: `src/components/admin/shared/AssigneeSelector.tsx, PrioritySelector.tsx, PresenceIndicator.tsx, EditorIndicator.tsx`_

## Anfrage-Erstellung (1)

- **2-Schritt-Wizard mit KI-Parsing** · 🔴 täglich  
  Neue Anfrage manuell anlegen: Freitext/E-Mail einfügen → KI extrahiert Kontakt- und Eventdaten (parse-inquiry-text) und parallel ein Freitext-Menüprogramm (parse-freeform-offer) → Kontakt/Details prüfen → Anfrage wird angelegt und das geparste Programm via sessionStorage in den OfferBuilder übergeben; KI-Paketvorschläge mit Konfidenz-Anzeige.  
  _Evidenz: `src/components/admin/refine/OfferCreate/index.tsx, AISuggestionsCard.tsx, ContactDataCard.tsx, EventDetailsCard.tsx`_

## Auth/Sicherheit (1)

- **Admin-Login-Schutz mit Rollen-Cache** · 🔴 täglich  
  AdminAuthGuard schützt alle /admin-Routen (Supabase-Session, Rolle admin/staff mit Berechtigungs-Hook usePermissions), robust gegen Token-Refresh; Logout im Sidebar-Footer.  
  _Evidenz: `src/components/admin/AdminAuthGuard.tsx, AdminLayout.tsx`_

## Website-Berührungspunkte (Shop) (1)

- **Lieferkosten-Rechner** · 🔴 täglich  
  Berechnet Lieferkosten für eine Kundenadresse: Geocoding + Fahrstrecke via OpenRouteService ab Karlstr. 47a, inkl. Mindestbestellwert, Frei-Lieferungs-Grenze, Hin-/Rückfahrt-Logik und Pizza-Sonderregel; Meldungen de/en.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/calculate-delivery/index.ts`_

## Bewertungen (1)

- **Google-Bewertungsanfragen automatisch senden** · 🟠 regelmäßig  
  Täglicher Cron (10 Uhr Berlin): sendet 2 Werktage nach dem Catering-Event eine Bewertungsanfrage per Mail — berücksichtigt Wochenenden und bayerische Feiertage sowie Abmeldungen.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/send-review-requests/index.ts`_

## Website-Berührungspunkte (Bewertungen) (1)

- **Abmeldeseite für Bewertungs-Mails** · 🟡 selten  
  Öffentlicher Unsubscribe-Link in Bewertungsanfragen: trägt die Adresse in die Abmeldeliste ein und zeigt eine gestaltete Bestätigungsseite.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/review-unsubscribe/index.ts`_

## DSGVO / Compliance (1)

- **Aufbewahrungs-Audit (Löschkandidaten)** · 🟡 selten  
  Ermittelt DSGVO-Löschkandidaten (nicht konvertierte/abgelehnte Anfragen, Mail-Logs, Anhänge, KI-Konversationen) aus Views und schreibt einen Audit-Eintrag — bewusst nur Dry-Run, löscht in diesem Build nie Daten.  
  _Evidenz: `/home/user/events-storia.de/supabase/functions/purge-retention/index.ts`_

## Event-Buchungen (1)

- **Buchungsverwaltung mit Menü-Bestätigung** · 🔴 täglich  
  Buchungsliste/-details inkl. Menü-Auswahl (Gänge + Getränkegruppen); Menü bestätigen setzt Status auf 'ready' und verschickt optional eine Bestätigungsmail an den Kunden; Badge für Buchungen mit unbestätigtem Menü; Liste bezahlter Buchungen.  
  _Evidenz: `src/hooks/useEventBookings.ts`_

## Druck (1)

- **Druckdaten-Aufbereitung (Küchen-/Laufzettel)** · 🟠 regelmäßig  
  Lädt eine Anfrage komplett für Druckdokumente: gewählte Angebots-Option mit Menü/Getränken/Equipment/Personal, Lieferadresse inkl. Stockwerk/Aufzug, Google-Maps-Link, Zahlungsstand und automatisch extrahierte Allergie-Hinweise aus Notizen/Kundennachricht; Mehrfachdruck parallel.  
  _Evidenz: `src/lib/print/fetchPrintData.ts, src/lib/print/types.ts`_

## Kostenuebernahme / eSignatur (1)

- **Audit-Timeline pro Kostenuebernahme** · 🟡 selten  
  Drawer mit chronologischen Audit-Ereignissen (inkl. Roh-Payload-Ansicht und Contract-ID) zu einer digitalen Kostenuebernahme — Nachvollziehbarkeit des gesamten Signatur-Lebenszyklus.  
  _Evidenz: `/home/user/events-storia.de/src/components/admin/refine/InquiryEditor/CostAcceptanceAuditDrawer.tsx`_
