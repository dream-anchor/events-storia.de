# MAESTRO SaaS-Playbook — Prompt-Blöcke

Erstellt: 2026-07-03
Status: Track A läuft parallel zu Track B · Neon-Projekt `events-storia.de` (Frankfurt, Neon Auth aktiv) angelegt

Jeder Abschnitt unten ist **ein vollständiger, in sich geschlossener Block**:
Modell + Reasoning-Stärke + kompletter Projekt-Kontext + Auftrag + Abnahme +
Abschluss-Schritte. Einfach den ganzen Block kopieren und in eine **neue**
Claude-Code-Session einfügen — nichts weiter ergänzen, nichts aus anderen
Abschnitten dazu mischen. Vor dem Einfügen das genannte Modell mit `/model`
einstellen.

Jeder Block endet mit einem `ABSCHLUSS`-Abschnitt: die Session committet/pusht,
öffnet bei Bedarf einen Draft-PR und gibt eine kurze Zusammenfassung aus. Sie
fasst dieses Playbook NICHT an — das Fortschritts-Tracking (unten) wird zentral
im Cockpit gepflegt, damit keine divergierenden Kopien auf Arbeits-Branches
entstehen. Der Nutzer überträgt die Zusammenfassung ins Cockpit; offene
„Rücksprache"-Punkte werden so sichtbar zurückgemeldet.

Warum zentral: Ausführungs-Sessions zweigen von `main` ab, wo dieses Playbook
(noch) nicht liegt — es lebt auf dem Cockpit-Branch. Würde jede Session hier ein
Kästchen abhaken, entstünden Merge-Konflikte und Doppel-Playbooks.

Reihenfolge: Track A (Sicherheit, sofort) läuft parallel zu Track B
(Neuaufbau, sequenziell — B-Nummern der Reihe nach abarbeiten, nicht
überspringen). Cutover (Abschnitt C) erst wenn B1–B12 stehen.

Grundlage: Tiefen-Audit der Codebasis (222 Migrationen, 105 Edge Functions,
~62.000 Zeilen Admin-Code, 31 Audit-Agenten + manuelles Auth-Sicherheitsaudit,
2026-07-03).

---

## Track A — Altsystem absichern (JETZT, parallel zu allem anderen)

Läuft im **bestehenden** Repo events-storia.de. Diese Lücken bedienen echte
Kunden heute und dürfen nicht auf den Neubau warten.

### A1 — Kritische Sicherheitslücken schließen

**Modell: Sonnet 5 · Reasoning-Stärke: mittel**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Phase 0 – Sicherheitslücken im LAUFENDEN System schließen
Nur das heutige Repo, KEIN Umzug, KEINE neuen Features. Einzeln, kleine Commits:

1. supabase/functions/lex-inspect löschen (offener LexOffice-Proxy ohne Auth)
   + Referenz in supabase/config.toml entfernen.
2. inbound-maestro-email + receive-inbound-email: den Header x-webhook-secret
   tatsächlich gegen ein Umgebungs-Secret prüfen; unsignierte Requests → 401.
3. public/vorschau-lagourres-restzahlung.html löschen (echte Kundendaten).
4. RLS: Policy "Anyone can insert v2_events" WITH CHECK(true) und
   "read v2_event_emails USING(true)" durch tenant-restriktive Varianten
   ersetzen (neue Migration, rückwärtskompatibel).
5. create-event-quotation und imap-sync (?diagnose=1) mit Auth-Check versehen.
6. Microsoft Clarity in index.html hinter Consent legen ODER entfernen.
7. .env aus Git-Historie/Tracking entfernen (git rm --cached, .gitignore
   ergänzen); Keys in IONOS/GitHub-Secrets rotieren, falls exponiert.

ABNAHME: build läuft grün; die genannten Endpunkte lehnen unsignierte
Requests ab; kurzer Report, was geändert wurde. Storia-Betrieb bleibt
funktionsfähig.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### A2 — Löschkonzept & Betroffenenrechte (DSGVO-Minimum)

**Modell: Sonnet 5 · Reasoning-Stärke: mittel**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: purge-retention scharf schalten + Betroffenenrechte-Basis
1. supabase/functions/purge-retention: Dry-Run-Sperre entfernen, echte
   Löschung implementieren (zuerst gegen eine Kopie/Staging testen), an einen
   pg_cron-Job hängen mit sinnvollem Intervall (z.B. täglich).
2. Retention-Policies (heute NULL) mit konkreten Fristen befüllen (Vorschlag
   pro Datenkategorie machen, ich entscheide final).
3. Einfache Datenexport-Function für einen Kunden (Art. 15/20 DSGVO):
   sammelt alle personenbezogenen Daten zu einer customer_id als JSON.
4. Einfache Löschfunktion für einen Kunden auf Anfrage (Art. 17), die
   referenzielle Integrität wahrt (Anonymisieren statt Hard-Delete wo nötig
   für Buchhaltungspflichten nach HGB/AO).

ABNAHME: purge-retention läuft im Dry-Run zuerst gegen Testdaten, dann scharf;
Export/Löschung sind als admin-only Edge Functions aufrufbar und getestet.
NICHT eigenmächtig scharf schalten ohne Rücksprache — Vorschlag zuerst zeigen.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### A3 — Async-Zahlungen & Refunds im Stripe-Webhook

**Modell: Opus 4.8 · Reasoning-Stärke: hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: handle-stripe-webhook um asynchrone Zahlungsarten erweitern
Heute wird NUR checkout.session.completed verarbeitet. SEPA-Lastschrift ist
aktiviert, meldet Erfolg aber über checkout.session.async_payment_succeeded —
dieser Fall wird nirgends behandelt (Zahlungen bleiben "offen" obwohl bezahlt).

1. Handler für checkout.session.async_payment_succeeded ergänzen (gleiche
   Logik wie completed, an den richtigen Zahlungspfad routen).
2. Handler für checkout.session.async_payment_failed ergänzen (Zahlung als
   fehlgeschlagen markieren, Kunde benachrichtigen).
3. charge.refunded und charge.dispute.created behandeln (Status in
   v2_payments spiegeln, LexOffice-Storno anstoßen wo zutreffend).
4. Stripe apiVersion über alle Payment-Functions vereinheitlichen (aktuell
   Mismatch zwischen '2025-08-27.basil' und '2024-06-20').

ABNAHME: Mit Stripe-Test-Events (SEPA-Testkarten/Test-IBANs) durchspielen;
bestehende Zahlungspfade (Karte) dürfen sich nicht ändern. Report mit den
getesteten Event-Typen.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

---

## Track B — Neuer Stack (Hauptprogramm), sequenziell

Läuft im **neuen, separaten Repository**. Reihenfolge ist eine
Abhängigkeitskette — B-Nummern der Reihe nach abarbeiten.

### B1 — Infrastruktur-Grundgerüst

**Modell: Sonnet 5 · Reasoning-Stärke: mittel**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Neues Repository + Cloudflare-Skelett aufsetzen
1. Neues Git-Repository "maestro-cloud" (oder ähnlich) anlegen.
2. Cloudflare Pages-Projekt für das Frontend + Wrangler-Konfiguration für
   Workers aufsetzen (leeres Vite-Projekt, gleiche Toolchain wie im
   Ursprungsrepo: React 18, Vite, shadcn/Tailwind, Refine v5).
3. Neon-Verbindung testen: @neondatabase/serverless Client, ein einfacher
   Health-Check-Worker, der eine SELECT 1 gegen Neon ausführt.
4. Neon Auth (Stack Auth) SDK einbinden, minimalen Login-Flow zum Testen
   (E-Mail/Passwort), OHNE noch Organizations/Tenants zu modellieren.
5. CI-Workflow (GitHub Actions) für Wrangler-Deploy auf Push.

ABNAHME: Health-Check-Worker antwortet, Login gegen Neon Auth funktioniert
lokal und in einer Cloudflare-Preview-Deployment. Kein Bezug zu
Storia-Fachlogik in diesem Schritt.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B2 — Multi-Tenant-Isolationsarchitektur entwerfen

**Modell: Fable 5 · Reasoning-Stärke: hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

VORWISSEN AUS DEM ALTSYSTEM-AUDIT (nicht wiederholen): Dort umging
service_role RLS komplett, der JWT-Tenant-Hook wurde nie aktiviert, es gab
USING(true)-Policies und globale statt mandantengebundene Rollen. Das darf
sich im neuen Stack strukturell nicht wiederholen.

# AUFGABE: Zielarchitektur für Mandantenisolation entwerfen (kein Code)
Liefere ein Architektur-Dokument, keine Implementierung.

1. Isolationsmodell entscheiden und begründen: Neon RLS mit JWT-Claims aus
   Neon Auth (Organizations als tenant_id) vs. reine App-Layer-Filterung im
   Worker vs. Kombination. Wie wird das diesmal strukturell erzwungen statt
   nur durch Disziplin/Konvention?
2. Wie werden Organizations (Neon Auth) auf das Datenmodell gemappt:
   1 Organization = 1 Restaurant/Tenant. Rollen innerhalb einer Organization
   (Owner/Admin/Staff) und wie sie in RLS-Policies einfließen.
3. Wie wird verhindert, dass EIN Datenbankzugriffspfad (z.B. ein
   Hintergrundjob, ein Webhook-Handler) versehentlich ohne Tenant-Filter auf
   alle Mandanten zugreifen kann? (Strukturelle Absicherung, z.B. durch
   erzwungene Connection-Pooling-Rolle pro Request statt eines globalen
   Admin-Connection-Strings für alles.)
4. Wie werden Secrets pro Mandant verwaltet (LexOffice-Key, IMAP-Zugang,
   Stripe) — eigener Vault-Namespace pro Organization?
5. Definiere den dünnsten vertikalen Spike (Login → Dashboard → 1 Anfrage
   anlegen) für einen frischen Test-Mandanten und liste die dafür nötigen
   Schritte in Reihenfolge.

ABNAHME: Entscheidungsdokument mit Begründung pro Punkt + konkreter,
priorisierter Schritt-Liste für den Spike. Wird vor Umsetzung zur Freigabe
vorgelegt.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B3 — Spike: dünner vertikaler Durchstich

**Modell: Opus 4.8 · Reasoning-Stärke: hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

VORAUSSETZUNG: Die Isolationsarchitektur aus dem vorherigen Schritt (Neon
RLS/App-Layer-Entscheidung, Organizations-Mapping) liegt bereits vor und ist
freigegeben — an dieser halten.

# AUFGABE: Vertikalen Spike für EINEN Test-Mandanten umsetzen
Ziel: nachweisen, dass Login → Dashboard → Anfrage anlegen auf dem neuen
Stack (Neon + Neon Auth + Cloudflare) end-to-end funktioniert, nach der
zuvor festgelegten Isolationsarchitektur.

1. Minimales Schema in Neon: tenants (= Neon Auth Organizations gespiegelt
   oder direkt referenziert), ein einfaches "events"-Äquivalent für Anfragen.
2. RLS/Isolation nach der Zielarchitektur umsetzen für dieses minimale Schema.
3. Einen Test-Mandanten ("Testrestaurant") + einen zweiten
   ("Testrestaurant B") anlegen und GEGENEINANDER TESTEN: Kann B die Daten
   von A sehen? Muss beweisbar Nein sein.
4. Dashboard-Seite (kann simpel sein, kein Full-UI-Port) zeigt Anfragen NUR
   des eingeloggten Mandanten.
5. Eine Anfrage anlegen (Formular oder Function) funktioniert und respektiert
   die Isolation.

ABNAHME: Zwei-Mandanten-Test dokumentiert und bestanden (A sieht B nicht,
B sieht A nicht — auch nicht über direkten API-Aufruf mit gültigem Token
des jeweils anderen Mandanten). Das ist das wichtigste Abnahmekriterium
im ganzen Projekt — nicht überspringen oder oberflächlich testen.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B4 — Datenschicht: Refine-Data-Provider für Neon

**Modell: Sonnet 5 · Reasoning-Stärke: mittel bis hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

VORAUSSETZUNG: Der Zwei-Mandanten-Isolationstest (Spike) ist bestanden.

# AUFGABE: Neuen Refine-Data-Provider für Neon/Cloudflare bauen
Der alte Provider (src/providers/refine-data-provider.ts im Ursprungsrepo)
spricht direkt mit Supabase/PostgREST. Das gibt es auf Neon nicht 1:1.

1. Entscheide: eigener PostgREST-artiger Worker vor Neon ODER ORM
   (Drizzle empfohlen wegen Neon-Serverless-Kompatibilität) mit
   dediziertem API-Layer pro Ressource. Begründung kurz festhalten.
2. Baue den Data-Provider für die Refine-Ressourcen aus dem Ursprungsrepo
   (menu_items, menus, event_inquiries-Äquivalent (jetzt v2_events-Nachfolger)
   etc. — Liste aus refine-data-provider.ts Zeile 5-23 des Altsystems
   übernehmen als Zielumfang), zunächst nur CRUD ohne Custom-Methoden.
3. Jede Query MUSS über die zuvor festgelegte Isolationsarchitektur laufen —
   kein ungefilterter Zugriff möglich, auch nicht "aus Versehen".
4. Tests: pro Ressource ein CRUD-Testfall + ein Cross-Tenant-Negativtest
   (Tenant A darf Ressource von Tenant B nicht lesen/schreiben).

ABNAHME: Alle Ressourcen aus der Liste haben CRUD-Tests grün, alle
Cross-Tenant-Negativtests grün. Kein Refine-Resource-Zugriff ohne
Tenant-Filter möglich.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B5 — Auth-Port: Login, Rollen, Session

**Modell: Opus 4.8 · Reasoning-Stärke: hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Admin-Login & Rollenmodell auf Neon Auth umstellen
Im Altsystem: src/hooks/useAdminAuth.ts, src/lib/adminAuth.ts,
src/providers/refine-auth-provider.ts (als Referenz für die UI/UX, NICHT
für die Implementierung übernehmen — dort war die Rollenprüfung
Cache-first und teils nur "advisory" im Frontend, das wird hier NICHT
wiederholt).

1. refine-auth-provider für Neon Auth bauen: login/logout/check/getIdentity.
2. Rollenmodell: Owner/Admin/Staff PRO Organization (nicht global wie im
   Altsystem — das war einer der Kernfehler dort).
3. Autorisierung MUSS serverseitig/DB-seitig erzwungen werden (RLS nach der
   Isolationsarchitektur), das Frontend-Gate ist nur UX, nie alleinige
   Kontrolle.
4. Einladungs-Flow für weitere Mitarbeiter eines Restaurants (Owner lädt
   Staff per E-Mail ein → Neon Auth Organization-Invite).

ABNAHME: Login/Logout/Rollenwechsel funktionieren; ein "Staff" kann keine
Owner-Aktionen ausführen (serverseitig getestet, nicht nur UI-verborgen);
Einladungs-Flow funktioniert end-to-end mit Test-E-Mail.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B6 — Kern-Workflow portieren (Anfrage → Angebot → Auftrag → Zahlung)

**Modell: Sonnet 5 · Reasoning-Stärke: mittel** (Zahlungslogik-Teilschritt separat mit **Opus 4.8 · hoch** ausführen)

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Kern-Workflow-UI aus dem Ursprungsrepo portieren
Referenz-Umfang (aus dem Audit als "KERN" markiert, 23 Edge Functions):
Anfrage-Erfassung, OfferBuilder (Angebot bauen/senden), Auftragsbestätigung,
Zahlungsauslösung (Stripe), Dashboard, Posteingang-Basis.

WICHTIG — nicht 1:1 kopieren, sondern bereinigt portieren:
1. NUR die lebenden Komponenten übernehmen (OfferBuilder, MenuComposer),
   NICHT die im Audit als tot identifizierten Duplikate (QuoteBuilder,
   EventEdit, MultiOffer, UnifiedInquiriesList, altes v1-Admin).
2. Die God-Files aus dem Audit (useOfferBuilder.ts 1801 Zeilen,
   SmartInquiryEditor.tsx 1498 Zeilen mit dokumentierten
   Autosave-Endlosschleifen) beim Portieren in kleinere, testbare Einheiten
   aufteilen — nicht als Monolith neu einfügen.
3. Zahlungsauslösung (create-offer-payment-link/create-balance-payment-link-
   Äquivalente) als EIGENEN Durchlauf mit Modell Opus 4.8 bearbeiten, da
   direkt zahlungsrelevant.
4. Jede Komponente bekommt mindestens einen Smoke-Test.

ABNAHME: Ein Testmandant kann end-to-end eine Anfrage erfassen, ein Angebot
bauen und senden, eine Testzahlung auslösen (Stripe Test-Mode) — alles im
neuen Stack, ohne Bezug zum Altsystem.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B7 — Storage: Buckets → R2

**Modell: Sonnet 5 · Reasoning-Stärke: mittel**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Supabase Storage durch Cloudflare R2 ersetzen
Referenz Buckets aus dem Altsystem: Fotoalbum, Mail-Anhänge, AI-Intake-
Uploads, signierte Kostenübernahme-PDFs (6 Buckets laut Audit).

1. R2-Buckets anlegen, Zugriffslogik (signierte URLs, tenant-gescopte Pfade
   z.B. /{tenant_id}/{bucket}/...) implementieren.
2. Upload/Download-Worker-Endpunkte, die die Mandanten-Isolation respektieren
   (Tenant A darf nie auf R2-Pfade von Tenant B zugreifen, auch nicht per
   erratener URL).
3. NUR die Buckets migrieren, die zu lebenden Features gehören (Fotoalbum
   war laut Audit ein Feature ohne Abnehmer — VORHER klären, ob es
   überhaupt portiert werden soll, nicht automatisch mitnehmen).

ABNAHME: Upload/Download funktioniert pro Tenant, Cross-Tenant-Zugriffstest
auf R2-Pfade schlägt fehl wie erwartet (403/404).

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B8 — Realtime-Ersatz

**Modell: Opus 4.8 · Reasoning-Stärke: hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Supabase Realtime durch Cloudflare-Lösung ersetzen
Betroffene Live-Features laut Audit: Mail-Thread-Updates, Präsenz-Anzeige,
Zahlungsstatus-Updates, Kostenübernahme-/Signatur-Flow (auch im
KUNDEN-Frontend, nicht nur Admin!).

1. Cloudflare Durable Objects (WebSocket-Hub pro Tenant) ODER Kurz-Polling
   als Fallback bewerten — Empfehlung mit Begründung.
2. Zuerst NUR für Zahlungsstatus + Kostenübernahme-Flow umsetzen (die
   kundenseitig sichtbar sind und Vertrauen betreffen), Präsenz/Mail-Thread-
   Live-Updates können initial auf Polling degradieren.
3. Mandanten-Isolation gilt auch hier: ein WebSocket-Kanal darf nie Events
   eines anderen Tenants zustellen.

ABNAHME: Zahlungsstatus-Änderung wird im Kunden-Frontend live sichtbar
(oder via Kurz-Polling binnen weniger Sekunden); Cross-Tenant-Leck-Test auf
den Kanal negativ.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B9 — Edge Functions → Workers (modulweise, pro Modul wiederholen)

**Modell: Sonnet 5 · Reasoning-Stärke: mittel**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Modul "<MODULNAME EINSETZEN>" von Supabase Edge Functions auf
Cloudflare Workers portieren
Bearbeite EIN Modul pro Durchlauf, in dieser Reihenfolge:
1. LexOffice (14 Functions)
2. IMAP/E-Mail-Inbox (21 Functions) — Achtung: Deno-IMAP-Library
   (imapflow/denomailer) läuft nicht nativ in Workers, ggf. externen
   IMAP-Relay-Service oder Cloudflare Email Workers prüfen (Vorschlag
   machen, nicht direkt entscheiden — Rücksprache).
3. eSignatures (9 Functions)
4. KI-Features (12+3 Functions) — Lovable AI Gateway ersetzen durch
   direkten Anthropic/OpenAI-Zugang, kein Lovable-Lock-in im neuen Stack.
5. WhatsApp/Reviews (3 Functions)

Für das jeweilige Modul:
a. Jede Function als Cloudflare Worker (oder Worker-Route) neu aufsetzen,
   Business-Logik übernehmen, Supabase-Client durch Neon-Zugriff ersetzen.
b. Secrets pro Tenant statt global.
c. Modul-Registry-Flag respektieren — Worker prüft am Anfang, ob das Modul
   für den Tenant aktiv ist.
d. Auth-Check: JEDE Function prüft Auth + Tenant, keine Ausnahmen wie im
   Altsystem (dort: 90 von 105 Functions ohne Tenant-Check).

ABNAHME PRO MODUL: Funktionstest im neuen Stack für einen Testmandanten;
Modul lässt sich für einen anderen Testmandanten deaktivieren und ist dann
nicht aufrufbar (403), nicht nur UI-verborgen.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B10 — Modul-Registry

**Modell: Sonnet 5 · Reasoning-Stärke: mittel**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Modul-Registry für Ein-/Ausschalten pro Mandant bauen
1. Tabelle tenant_modules (tenant_id, module_key, enabled, config jsonb).
2. Server-seitige Helper-Function assertModuleEnabled(tenantId, moduleKey),
   die JEDE Modul-Function am Anfang aufruft.
3. Frontend: aktive Module beim Login laden, Navigation/Buttons entsprechend
   ein-/ausblenden (nur UX-Komfort, die eigentliche Durchsetzung ist
   serverseitig).
4. Einfache Admin-UI (kann rudimentär sein): Owner eines Tenants sieht
   Liste der Module, kann sie an-/abschalten (nur er selbst für seinen
   eigenen Tenant — Cross-Tenant-Test!).

ABNAHME: Modul lässt sich pro Tenant unabhängig von anderen Tenants
schalten; deaktiviertes Modul ist serverseitig blockiert, nicht nur
UI-versteckt.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B11 — Onboarding & Provisioning für neue Restaurants

**Modell: Sonnet 5 · Reasoning-Stärke: mittel bis hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Selbst-Onboarding-Flow für ein neues Restaurant
1. Registrierungs-Flow: neue Neon Auth Organization anlegen, Owner-Account,
   initiale tenants-Zeile, Default-Module (nur Kern aktiv).
2. Basis-Konfiguration im Onboarding abfragen: Restaurantname, Adresse
   (NAP), MwSt-Sätze, Absender-E-Mail, Zeitzone/Währung/Sprache (nur die
   Datenfelder anlegen, nicht die volle Übersetzung).
3. Domain-/Subdomain-Zuweisung: z.B. <slug>.maestro-app.de initial,
   Custom-Domain später optional.
4. E-Mail-Verifizierung + Absender-Domain-Setup-Hinweise für Resend
   (SPF/DKIM pro Tenant-Domain).

ABNAHME: Ein komplett neues Test-Restaurant kann sich selbst anlegen und
landet in einem isolierten, funktionsfähigen Zustand mit nur den
Kern-Modulen aktiv — ohne dass ich manuell in der DB etwas anlegen muss.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B12 — Billing/Subscription-Infrastruktur

**Modell: Opus 4.8 · Reasoning-Stärke: hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Abo-/Billing-Grundgerüst für das SaaS selbst
Unterscheide: das ist Stripe-Abrechnung DURCH DICH (SaaS-Betreiber) AN DIE
RESTAURANTS — nicht die Restaurant→Endkunde-Zahlungen aus dem Kern-Workflow.

1. tenants um plan/trial_ends_at/currency/billing_status erweitern.
2. Stripe Billing/Subscriptions für Tenant-Abos (Plan-Stufen = Modul-Pakete)
   — Checkout, Kündigung, Zahlungsfehler-Handling.
3. Klären (Rücksprache vor Umsetzung): Stripe Connect für die
   Restaurant→Endkunde-Zahlungen (du als Plattform nimmst eine Gebühr,
   Auszahlung ans Restaurant) ODER eigener Stripe-Account pro Restaurant?
   Diese Entscheidung vor Code-Beginn einholen.
4. Modul-Freischaltung an Billing-Status koppeln (Modul nur aktivierbar,
   wenn im gebuchten Plan enthalten).

ABNAHME: Test-Abo abschließen/kündigen funktioniert; Modul-Zugriff wird bei
Kündigung/Zahlungsausfall korrekt entzogen (mit Kulanzfrist, keine
sofortige Kaltabschaltung).

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B13 — PWA / Offline / Push

**Modell: Sonnet 5 · Reasoning-Stärke: mittel**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Handy-first-Fähigkeit nachrüsten
Das Tool soll primär vom Handy bedienbar sein — im Altsystem wurden Service
Worker aktiv deregistriert (Gegenteil vom Ziel).

1. Service Worker + Web App Manifest für installierbare PWA.
2. Offline-Fallback zumindest für Lese-Ansichten (Dashboard, Anfragenliste)
   mit klarer "Offline"-Kennzeichnung, kein stilles Fehlverhalten.
3. Push-Benachrichtigungen (Web Push) für neue Anfragen — das ist der
   wichtigste einzelne Business-Value dieses Schritts: der Gastronom
   erfährt von einer neuen Anfrage, auch wenn die App nicht offen ist.
4. Reduced-Motion/Accessibility beachten, kein aggressives Caching, das
   veraltete Zahlungsstatus zeigt.

ABNAHME: App installierbar auf iOS/Android-Homescreen; Test-Push-
Benachrichtigung kommt an, wenn App im Hintergrund/geschlossen ist.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### B14 — i18n-Grundgerüst

**Modell: Haiku 4.5** für die String-Extraktion **· Reasoning-Stärke: niedrig** — **Sonnet 5** für die Framework-Integration **· Reasoning-Stärke: mittel**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: i18n-Framework einführen (Admin-UI ist heute rein Deutsch)
1. i18n-Library einbinden (z.B. react-i18next), Deutsch als Erstsprache
   1:1 extrahieren (keine Übersetzung nötig, nur Struktur).
2. Zeitzone/Währung aus tenants-Konfiguration lesen statt hartkodiert.
3. Zweite Sprache (Englisch) als Testfall für mindestens Dashboard +
   OfferBuilder, um das Framework zu validieren.

ABNAHME: Sprachwechsel funktioniert für die getesteten Bereiche; keine
hartkodierten deutschen Strings mehr in den portierten Kern-Komponenten.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

---

## Cutover (erst wenn B1–B12 stehen)

### C1 — Storia-Datenmigration (Dry-Run zuerst)

**Modell: Opus 4.8 · Reasoning-Stärke: hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Migrationsskript Supabase → Neon für Storia-Daten
1. Migrationsskript pro Tabellengruppe (v2_events, v2_customers,
   v2_payments, Menüs/Pakete, etc.), das Storias Daten in den neuen Stack
   unter EINER Organization "Storia" überführt.
2. ERST gegen eine Kopie/Staging-Instanz von Neon laufen lassen, Zeilen-
   zahlen und Stichproben gegen die Quelle validieren (kein Silent-Data-
   Loss).
3. Idempotenz: Skript muss mehrfach laufen können (Testläufe), ohne
   Duplikate zu erzeugen.
4. Report: was migriert wurde, was NICHT (z.B. tote Legacy-Tabellen
   bewusst ausgelassen), mit Begründung.

ABNAHME: Dry-Run-Report zeigt vollständige, validierte Übernahme der
lebenden Daten. KEINE Ausführung gegen Produktions-Neon ohne meine
ausdrückliche Freigabe des Dry-Run-Reports.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### C2 — Finaler Security- & Isolations-Review

**Modell: Fable 5 · Reasoning-Stärke: hoch**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

VORAUSSETZUNG: Der Dry-Run der Datenmigration (Storia → Neon) ist validiert
und freigegeben.

# AUFGABE: Adversarialer Security-Review vor Produktiv-Cutover
Prüfe den GESAMTEN neuen Stack, als würdest du versuchen, ihn zu brechen:

1. Kann ein Tenant unter irgendeinem Pfad (API, Worker, Realtime-Kanal,
   R2-Pfad, Public-Offer-Link) auf Daten eines anderen Tenants zugreifen?
   Konkret gegen Storia + mindestens einen zweiten Testmandanten prüfen.
2. Sind alle Modul-Functions tatsächlich auth- und tenant-geprüft (keine
   Wiederholung des alten Fehlers: 90 von 105 Functions ohne Check)?
3. Secrets: liegt irgendwo ein globaler statt tenant-spezifischer Schlüssel
   im Zugriff des falschen Tenants?
4. Zahlungs-/Webhook-Pfade: Race Conditions, doppelte Verarbeitung,
   fehlende Idempotenz?
5. DSGVO-Minimum vorhanden (Löschung, Export, AVV-Grundlage)?

ABNAHME: Schriftlicher Befund mit Schweregrad je Finding. Bei JEDEM
"kritisch"-Finding: Cutover verschiebt sich, bis behoben. Kein Kompromiss
bei Cross-Tenant-Findings.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### C3 — Parallelbetrieb & Monitoring

**Modell: Sonnet 5 · Reasoning-Stärke: mittel**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

VORAUSSETZUNG: Der Security-Review ist bestanden, keine kritischen
Findings mehr offen.

# AUFGABE: Parallelbetrieb-Fenster einrichten
1. Neuer Stack läuft produktiv für Storia PARALLEL zum Altsystem (z.B.
   über eine interne Test-URL, noch nicht öffentliche Domain).
2. Error-Monitoring (z.B. Sentry o.ä.) für den neuen Stack einrichten —
   im Altsystem gab es laut Audit kein Frontend-Monitoring.
3. Definierten Zeitraum (Vorschlag: 1–2 Wochen) echten Testbetrieb mit
   Schattendaten oder echten Storia-Daten (read-only Vergleich) fahren.
4. Abweichungs-Report: wo verhält sich der neue Stack anders als der alte?

ABNAHME: Monitoring aktiv, Parallelbetrieb-Zeitraum definiert und von mir
freigegeben, bevor der eigentliche Cutover startet.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

### C4 — Cut-over

**Modell: Sonnet 5 · Reasoning-Stärke: mittel** für die Technik — **der eigentliche Umschalt-Zeitpunkt (DNS/Go-Live) ist ein manueller Schritt durch dich, nicht durch das Modell**

```
# PROJEKT-KONTEXT
MAESTRO = Gastro-Backoffice-Tool (React/Vite + Refine v5) unter Route /admin im
Repo events-storia.de. Heute Single-Tenant für Restaurant "Storia", läuft
PRODUKTIV und darf nicht unterbrochen werden.

ZIEL: MAESTRO als eigenständiges Multi-Tenant-SaaS auf Neon (Postgres,
eu-central-1, Neon Auth mit Organizations als Mandanten-Modell) + Cloudflare
(Pages + Workers) herauslösen. events-storia.de bleibt bei IONOS, wird aber
technisch komplett von MAESTRO getrennt. PublicOffer (Kunden-Angebotsseite)
gehört zu MAESTRO, nicht zur Website.

STRATEGIE: Paralleler Aufbau in einem NEUEN, separaten Repository. Der
bestehende Stack (Supabase/IONOS) läuft während des gesamten Umbaus unverändert
weiter. Cut-over erst nach validierter Migration + Security-Review. UI-Code
wird wiederverwendet/portiert, nicht neu geschrieben.

REGELN: Ein Thema pro Auftrag, kleine PRs/Commits. Storia-Produktivbetrieb
bleibt während des gesamten Umbaus intakt. Secrets nur aus Umgebungsvariablen,
nie im Code oder Prompt.

# AUFGABE: Technische Cutover-Vorbereitung
1. Finale Datensynchronisation (Delta seit dem Dry-Run) vorbereiten,
   Skript für minimalen Umschalt-Zeitraum.
2. Rollback-Plan schriftlich: wie kommen wir in unter 1 Stunde zurück zum
   Altsystem, falls nach Cutover kritische Probleme auftreten?
3. Checkliste für den eigentlichen Umschalt-Moment (DNS/Routing) erstellen
   — DIESEN Schritt führt der Nutzer manuell aus, nicht automatisiert, da
   er endgültig ist.

ABNAHME: Rollback-Plan getestet (Trockenübung); der Cutover-Zeitpunkt wird
vom Nutzer entschieden. Altsystem wird NICHT abgeschaltet, bis der neue
Stack mindestens 1–2 Wochen fehlerfrei produktiv lief.

ABSCHLUSS (immer am Ende dieser Aufgabe):
1. Arbeit committen + auf den Arbeits-Branch pushen; falls noch kein offener
   PR für den Branch existiert, einen Draft-PR öffnen.
2. Eine 3–5-Zeilen-Zusammenfassung an den Nutzer ausgeben: was erledigt,
   welche Abnahmekriterien grün, welche Entscheidung/Rücksprache offen (z.B.
   IMAP-Relay, Stripe Connect, Retention-Fristen). Der Nutzer überträgt sie
   ins Cockpit, das das Fortschritts-Tracking pflegt.
3. KEINE Playbook-Datei (docs/MAESTRO-SAAS-PLAYBOOK.md) anlegen oder ändern —
   die liegt zentral im Cockpit und wird nur dort gepflegt. Kein zweites
   Tracking auf diesem Branch erzeugen.
```

---

## Noch offene Entscheidungen (vor dem jeweiligen Schritt klären)

| Entscheidung | Relevant ab | Empfehlung |
|---|---|---|
| Stripe Connect vs. eigener Account pro Restaurant | B12 | Connect (einfacheres Onboarding, Plattform-Gebühr integriert) |
| Preis-/Modul-Tarifstufen | B10/B12 | Vorschlag: Basis (Kern) + Add-ons (LexOffice, KI, eSignatures, WhatsApp) einzeln buchbar |
| IMAP/E-Mail-Architektur auf Workers | B9 (Modul 2) | Deno-IMAP-Libraries laufen nicht nativ in Workers — externer Relay oder Cloudflare Email Workers nötig, vorab entscheiden |
| Domain-Schema pro Tenant | B11 | `<slug>.maestro-app.de` initial, Custom-Domain als späteres Upsell-Feature |
| Zero-Downtime-Anforderung fürs Cutover | C4 | Aktuell: kurzes Wartungsfenster akzeptabel (siehe Parallelbetrieb-Strategie) |

## Fortschritts-Tracking

- [~] **Track A** — Altsystem absichern
  - [x] A1 Sicherheitslücken geschlossen — PR #2 (Draft, `claude/security-fixes-current-5jj62e`).
        Umgesetzt: lex-inspect entfernt, x-webhook-secret erzwungen (401),
        Kundendaten-Preview gelöscht, RLS v2_events/v2_event_emails verschärft,
        Clarity hinter Consent.
        OFFEN (Lücke ggü. Vollversion): create-event-quotation + imap-sync
        `?diagnose=1` Auth-Check (Punkt 5) und `.env` aus Git entfernen (Punkt 7)
        wurden NICHT umgesetzt → siehe Folgeaufgabe A1b.
        MANUELL vor Merge-Wirkung: MAESTRO_WEBHOOK_SECRET als Supabase-Secret
        setzen + `supabase db push` für die Migration.
  - [ ] A1b create-event-quotation/imap-diagnose Auth + .env aus Git (Rest aus A1)
  - [~] A2 Löschkonzept + Betroffenenrechte — in Arbeit (Sonnet, Branch `claude/dsgvo-loeschkonzept`)
  - [~] A3 Async-Zahlungen/Refunds im Webhook — in Arbeit (Opus, Branch `claude/stripe-async-payments`)
- [ ] **Track B** — Neuer Stack
  - [ ] B1 Infra-Grundgerüst
  - [ ] B2 Isolationsarchitektur entworfen & freigegeben
  - [ ] B3 Spike bestanden (Cross-Tenant-Test grün)
  - [ ] B4 Data-Provider
  - [ ] B5 Auth-Port
  - [ ] B6 Kern-Workflow portiert
  - [ ] B7 Storage → R2
  - [ ] B8 Realtime-Ersatz
  - [ ] B9 Module portiert: [ ] LexOffice [ ] IMAP [ ] eSignatures [ ] KI [ ] WhatsApp
  - [ ] B10 Modul-Registry
  - [ ] B11 Onboarding/Provisioning
  - [ ] B12 Billing
  - [ ] B13 PWA/Offline/Push
  - [ ] B14 i18n
- [ ] **Cutover**
  - [ ] C1 Datenmigration (Dry-Run validiert)
  - [ ] C2 Security-Review bestanden (keine kritischen Findings offen)
  - [ ] C3 Parallelbetrieb abgeschlossen
  - [ ] C4 Cutover durchgeführt, Altsystem abgeschaltet
