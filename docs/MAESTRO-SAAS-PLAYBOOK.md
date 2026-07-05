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

## Feature-Modul: Kunden-Intelligenz (Lead-Enrichment & Risiko-Ampel)

> Recherchiert + adversarial verifiziert 2026-07-05 (12 Agenten, Quellen unten).
> **Ziel:** Bei jeder eingehenden Anfrage den Anfragenden wirtschaftlich einschätzen
> (Zahlungsausfall-Risiko), damit der Betrieb Anzahlungshöhe/Zahlungsziel bewusst
> staffeln kann. **Differenzierung:** Tripleseat/Perfect Venue/Event Temple bieten
> Lead-Scoring UND Zahlungsautomatisierung, aber **kein** Event-Tool koppelt eine
> Risiko-Bewertung an die Anzahlungslogik. Genau diese Kopplung ist der USP.

### Leitprinzip: Zwei-Stufen-Architektur (DSGVO-Kern)
- **Stufe 1 – automatisch bei Anfrageeingang, NUR juristische Personen (Firmen):**
  Firmen-Stammdaten, Rechtsform, Firmenalter, Insolvenzstatus, Firmenbonität.
  Firmendaten juristischer Personen fallen nach **ErwG 14 DSGVO** weitgehend NICHT
  unter die DSGVO → automatischer Abruf zulässig.
- **Stufe 2 – manuell/ereignisgesteuert, personenbezogen (Bonität natürlicher Personen):**
  Nur bei **konkreter Vertragsanbahnung mit echtem Vorleistungsrisiko**, nie in der
  reinen Angebotsphase. B2C (Hochzeit/Geburtstag einer Privatperson) → **keine**
  automatische Auskunftei-Abfrage; Risiko dort ausschließlich über **Anzahlung/Vorkasse**
  steuern (das mildere Mittel, macht die Bonitätsprüfung meist schon „nicht erforderlich").

### Datenquellen-Matrix (Stand 2026, Self-Service-tauglich für kleines SaaS)
| Quelle | Liefert | Modell / Preis | Bewertung |
|---|---|---|---|
| **Impressum-Crawl (§5 DDG)** | Firma, HRB-Nr, Registergericht, USt-ID, GF | gratis | **Basis-Schritt** — HRB-Nr = exakter Lookup-Schlüssel, vermeidet Namens-False-Positives |
| **OpenRegister API** | GF, Gesellschafter, UBO, Financials, Dokumente | Self-Service, Free 50/Mon, Pro 59 €/Mon (~0,10–0,20 €/Profil) | **Primärquelle v1** (Startup-Rabatt bis 50% erfragen) |
| **handelsregister.ai** | + AI-Fuzzy-Suche, Insolvenz, Kontakt, Jahresabschluss (Markdown), MCP-Server | 500 Gratis-Credits, Plus ab 69 €/Mon | **Zweitquelle** — Fuzzy-Suche passt zu unstrukturierten Formular-Eingaben |
| **VIES-REST + BZSt eVatR** | USt-ID-Validierung (DE: nur Gültigkeit; EU: qualifiziert) | gratis, kein Key | USt-ID-Feld im Formular validieren (alte XML-RPC seit 30.11.2025 tot) |
| **insolvenzbekanntmachungen.de / Insolvenz-Radar API** | Insolvenzstatus | Self-Service (Insolvenz-Radar) | **Firmeninsolvenzen NICHT auf 2 Wochen begrenzt** (§2 InsBekV n.F. — die 2-Wochen-Sperre gilt nur für **Verbraucher**insolvenzen; verifiziert-korrigiert) |
| **Google Places API** | Kategorie, Bewertungen, Öffnungszeiten (Größen-/Seriositätsindiz) | ~17 $/1.000 Details (FieldMask streng setzen!) | optional, günstiges Firmensignal |
| **Brave Search / Exa API** | LinkedIn-Profil-**Links** + Snippets on-demand | Brave 2.000 Queries/Mon gratis, eigener Index | Personen-Lookup **ohne Speichern** (SerpApi meiden — Google-Klage 12/2025) |
| **Dropcontact** (optional Stufe 3) | Firmendaten inkl. Branche/Größe, E-Mail-Verifikation | ab 24 €/Mon, französisch, **keine Personendatenbank** | DSGVO-vertretbarer Enrichment-Anbieter, falls Speicherung gewünscht |
| **Stripe + Billie (B2B-BNPL)** | Echtzeit-Bonität, **trägt Ausfallrisiko** | Payment-Method auf bestehendem Stripe | **Bevorzugter Weg für Zahlungsausfallrisiko** — SaaS verarbeitet KEINE Bonitätsdaten |

**Bewusst NICHT in v1:** eigenes Scraping von handelsregister.de (Nutzungsordnung: max.
60 Abrufe/h, Verbot autom. Massenabfragen, §§303a/b StGB), LinkedIn-Scraping/Proxycurl
(von LinkedIn verklagt, 04.07.2025 dichtgemacht — Totalausfall-Risiko), klassische
Auskunfteien Creditreform/CRIF/Schufa (vertriebsgeführt, berechtigtes Interesse pro
Abruf nötig — falls später: Creditsafe Connect als Einstieg).

**Erwartungssteuerung Finanzdaten:** Kleinst- und kleine Kapitalgesellschaften
(die typischen Anfrager-GmbHs) veröffentlichen **keinen Umsatz** — nur (verkürzte)
Bilanz. Score/UI müssen fehlende Umsatzdaten als **Normalfall** behandeln; Proxy =
Bilanzsumme, Eigenkapital, Stammkapital, Rechtsform, Firmenalter.

### DSGVO-Leitplanken (harte Regeln — vor Bau umsetzen)
1. **Rechtsgrundlage:** Art. 6(1)(f) (bzw. (b) vorvertraglich). Vorteil hier: Es geht um
   Anreicherung der **eigenen eingehenden Anfrage** des Betroffenen, nicht Cold Outbound →
   Interessenabwägung fällt leichter, §7 UWG greift nicht. LIA schriftlich dokumentieren.
2. **Transparenz Art. 13/14:** Datenschutzhinweis direkt im Anfrageformular + **aktive**
   Information (Kategorien, Quellen, Widerspruchsrecht Art. 21) spätestens mit der ersten
   Antwort-Mail (Template-Baustein im SaaS). NICHT auf „unverhältnismäßiger Aufwand" bauen.
3. **GF-Daten aus HR** sind personenbezogen (EuGH C-710/23): strikte Zweckbindung, keine
   anlasslose GF-Vorratsdatenbank, Löschung an den Anfrage-Lifecycle koppeln (C-26/22).
4. **LinkedIn = nur verlinken**, keine Profildaten kopieren/persistieren.
5. **Score Art.-22-sicher:** keine Auto-Ablehnung, Einzelfaktoren + Rohdaten anzeigen (nicht
   nur eine Zahl), Mensch muss abweichen können (Abweichung protokollieren), Monitoring —
   folgen Betriebe faktisch immer dem Score, droht Einstufung als autom. Einzelentscheidung
   (EuGH C-634/21) mit Erklär-/Anfechtungspflichten. Score **empfiehlt**, Mensch entscheidet.
6. **Verträge:** AVV SaaS↔Betrieb (Art. 28); Auskunfteien = Controller-zu-Controller (kein
   AVV, aber berechtigtes Interesse je Abruf dokumentieren — Pflichtfeld „Anlass"); reine
   Enrichment-APIs = AVV. **DSFA (Art. 35)** fürs Scoring; LIA+DSFA als Compliance-Paket an
   die Gastro-Kunden mitliefern.
7. **Löschung:** Anreicherungsdaten löschen, wenn die Anfrage nicht zum Vertrag führt
   (Wochen bis max. 6 Monate); absolute Obergrenze 3 Jahre (Code of Conduct Auskunfteien).
   Widerspruch (Art. 21) → Anreicherung stoppen + Daten löschen. Passt zum bestehenden
   Löschkonzept aus Track A2.

### Risiko-Ampel: 7-Faktor-Score + Aktions-Matrix
Gewichteter Score (0–100), Schwellen initial **75 (grün) / 50 (gelb)**, nach 6 Monaten
gegen reale Verzüge kalibrieren. **K.-o.-Kriterien → sofort ROT:** laufendes
Insolvenzverfahren, früherer Forderungsausfall beim eigenen Betrieb.

| Faktor | Gewicht | Quelle |
|---|---|---|
| Eigene Zahlungshistorie (Verzugstage, Mahnstufen) | **25 %** | intern (Stripe/Aufträge) — **stärkster Prädiktor**, Benchmark Ø 7,5 Tage Verzug (DE) |
| Externer Bonitätsindex | 20 % | nur wenn abgefragt (sonst Gewicht auf Gratis-Signale umlegen) |
| Rechtsform / Haftung | 15 % | UG (1 € Stammkapital) = hohes Risiko · GbR/e.K. persönliche Haftung |
| Storno / No-Show-Quote | 10 % | intern |
| Firmenalter | 10 % | <2 J. stärkster Insolvenzanstieg, <4 J. = 21 % aller Verfahren |
| Web-/Domain-Präsenz | 10 % | WHOIS-Domain-Alter, Freemail-Erkennung, Google-Bewertungen |
| Auftragsrisiko (Wert × Vorleistung) | 10 % | intern (Angebotswert) |

**Aktions-Matrix (Score steuert Anzahlung im Angebots-/Checkout-Flow):**
- 🟢 **Grün:** Rechnung 14–30 Tage + 30 % Anzahlung (Stammkunde → VIP-Flag, Priorisierung)
- 🟡 **Gelb:** 50 % Anzahlung + Rest 7 Tage vor Event, kein Zahlungsziel
- 🔴 **Rot:** 100 % Vorkasse via Stripe **oder** begründete Absage

Catering-Faustregeln (Kalibrierungs-Basis): Anzahlung 20–50 % bei Buchung (30 % gängig,
50 % verbreitet), Rest ~1 Monat bzw. 7–14 Tage vor Event, B2B-Zahlungsziel default 30 Tage.
Karten-Hinterlegung senkt No-Shows nachweislich bis −65 %.

### Umsetzung gegen unseren Stack (Neon + Cloudflare Worker)
1. **Trigger:** Beim Insert einer Anfrage (POST /api/inquiries) asynchron eine
   Enrichment-Aufgabe anstoßen (Worker-`ctx.waitUntil` oder Queue), damit die Formular-Antwort
   nicht blockiert.
2. **Pipeline:** E-Mail-Domain → Website/Impressum crawlen + per LLM parsen → HRB-Nr →
   OpenRegister/handelsregister.ai-Lookup → Insolvenz-Check → interne Historie aggregieren
   (Neon-View pro Kunde: Ø Verzugstage, Mahnstufen, Stornoquote, Auftragsalter/-wert).
3. **Speicherung:** neue Tabelle `customer_intel` (tenant-scoped, RLS wie alles) mit
   Roh-Signalen + Score + Faktor-Aufschlüsselung + `expires_at` (Löschautomatik).
   Secrets der Enrichment-APIs als Worker-Secrets, nie im Client.
4. **UI:** Ampel-Badge im Anfrage-Detail-Drawer + aufklappbare Faktor-Liste (Erklärbarkeit);
   Anzahlungs-Vorschlag im Angebots-Builder vorbelegt, aber editierbar (Mensch bestätigt).
5. **Positionierung im Produkt:** als **„Recherche-Assistent"** framen (Links, öffentliche
   Firmendaten, Vorschläge), NICHT als Profildatenbank → minimiert Rechts- UND
   Anbieter-Abhängigkeitsrisiko (Enrichment-Markt ist 2025/26 instabil).

### Phasen
- **v1 (gratis, sofort, größter Hebel):** interne Historie-Signale (Neon-View) + Rechtsform-Parsing
  + Impressum/USt-ID + Insolvenz-Check + Anzahlungs-Staffel. Kein externer Cent nötig.
- **v2 (bezahlt, ab Schwelle):** OpenRegister/handelsregister.ai für Firmen-Stammdaten/Financials;
  bezahlte Bonität (Creditsafe/Creditreform) nur ab Auftragswert-Schwelle (z. B. 5.000 €) und
  nur bei Rechnungskauf-Wunsch, Ergebnis 12 Monate cachen.
- **v3 (optional):** Personen-Lookup (Brave/Exa, nur Links), Dropcontact, Billie als
  Ausfallrisiko-Offloading.

### Offene Nutzer-Entscheidungen (vor Bau klären)
- Auftragswert-Schwelle für bezahlte Bonität + für „personenbezogene Stufe 2".
- Datenschutzerklärung + Anfrageformular-Hinweis + Antwort-Mail-Baustein juristisch final abstimmen
  (Speranza GmbH/DSB) — analog Track A2.
- Budget für Enrichment-APIs (OpenRegister Pro 59 €/Mon als Startpunkt) freigeben.
- Billie als Stripe-Payment-Method aktivieren (ja/nein).

### Quellen (Auswahl, verifiziert)
handelsregister.de-Nutzungsordnung + fragdenstaat.de (keine offizielle API) · DiRUG (Gratis-Abrufe
seit 1.8.2022) · openregister.de/docs (Pricing) · handelsregister.ai · §2 InsBekV n.F. (2-Wochen-Sperre
nur Verbraucher) · EuGH C-621/22, C-634/21, C-710/23, C-26/22 · ErwG 14 DSGVO · hiQ/Proxycurl-Verfahren ·
Creditreform Zahlungsindikator H2/2025 · VIES-REST + BZSt eVatR.

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
| Stripe Connect vs. eigener Account pro Restaurant | B12 | ✅ ENTSCHIEDEN (2026-07-03): **Stripe Connect** — Restaurants als verbundene Konten; in B2 (Secret-Isolation) + B12 einplanen |
| Domain-Schema pro Tenant | B11 | ✅ ENTSCHIEDEN (2026-07-03): **Subdomain zuerst** (`<slug>.maestro-app.de`), Custom-Domain später als Upsell |
| Preis-/Modul-Tarifstufen | B10/B12 | ⏳ SPÄTER (Nutzer, 2026-07-03): Modul-Registry technisch bauen (an/aus pro Mandant), Preiszuordnung erst bei B10/B12 festlegen |
| IMAP/E-Mail-Architektur auf Workers | B9 (Modul 2) | OFFEN: Deno-IMAP-Libraries laufen nicht nativ in Workers — externer Relay oder Cloudflare Email Workers nötig, vorab entscheiden |
| Retention-Fristen (DSGVO) | A2 | ✅ ENTSCHIEDEN (2026-07-03): **Ruhende Kundenstammdaten OHNE Buchung → 36 Monate ab letzter Aktivität, dann Auto-Löschung.** AUSNAHME (unberührt): Rechnungen/Zahlungen/buchhaltungsrelevante Kundendaten **mind. 13 Jahre** aufbewahren (10 J. ab Steuerbescheid, HGB §257/AO §147), werden anonymisiert statt gelöscht. Übrige Kategorien (nicht konvertierte Anfragen 12 M., abgelehnte Angebote 6 M., KI-Chats 6 M., Versand-Logs 90 T. …) noch A2-Vorschlagswerte — separat bestätigen. Scharfschaltung erst nach fachlichem Nicken (Steuerberater/DSB) + bewusster Aktivierung. |
| Zero-Downtime-Anforderung fürs Cutover | C4 | OFFEN: aktuell kurzes Wartungsfenster akzeptabel (siehe Parallelbetrieb-Strategie) |

## Fortschritts-Tracking

- [~] **Track A** — Altsystem absichern (Code fertig; offen: Merges sequenziell + manuelle Secrets/Aktivierung)
  - [x] A1 Sicherheitslücken geschlossen — PR #2 (Draft, `claude/security-fixes-current-5jj62e`).
        Umgesetzt: lex-inspect entfernt, x-webhook-secret erzwungen (401),
        Kundendaten-Preview gelöscht, RLS v2_events/v2_event_emails verschärft,
        Clarity hinter Consent.
        OFFEN (Lücke ggü. Vollversion): create-event-quotation + imap-sync
        `?diagnose=1` Auth-Check (Punkt 5) und `.env` aus Git entfernen (Punkt 7)
        wurden NICHT umgesetzt → siehe Folgeaufgabe A1b.
        MANUELL vor Merge-Wirkung: MAESTRO_WEBHOOK_SECRET als Supabase-Secret
        setzen + `supabase db push` für die Migration.
  - [x] A1b create-event-quotation/imap-diagnose Auth + .env aus Git — PR #5 (Draft, `claude/security-fixes-rest-a1b`).
        create-event-quotation: Hybrid — requireAuth (admin/staff) default + x-webhook-secret-Bypass
        (separates Secret MAESTRO_INTERNAL_FUNCTION_SECRET) für 3 interne Aufrufer, weil einer
        (notify-customer-response) von der öffentlichen Angebotsseite getriggert wird; verify_jwt=true.
        imap-sync: nur der ?diagnose=1-Zweig hinter IMAP_SYNC_DIAGNOSE_SECRET (Sync-Betrieb unangetastet).
        .env: aus Git-Tracking entfernt (nur öffentliche VITE_-Keys, keine Rotation nötig, kein History-Rewrite).
        MANUELL vor Merge-Wirkung: 2 Supabase-Secrets setzen (MAESTRO_INTERNAL_FUNCTION_SECRET, IMAP_SYNC_DIAGNOSE_SECRET).
  - [x] A2 Löschkonzept + Betroffenenrechte — PR #6 (Draft, `claude/dsgvo-loeschkonzept`).
        purge-retention: admin-only + echter mode="hard" hinter 3 Sperren (env PURGE_DRY_RUN=false
        + Policy enabled/dry_run=false + expliziter Request), Buchhaltungs-Bezug immer ausgeschlossen.
        Neu: export-customer-data (Art. 15/20, read-only), delete-customer-data (Art. 17, default Preview,
        Ausführung nur mit GDPR_ERASURE_ENABLED=true + execute + confirm; Buchhaltungsdaten anonymisiert
        statt gelöscht, 10 J. HGB/AO). pg_cron-Migration vorbereitet aber AUSKOMMENTIERT (No-Op).
        GATE (Nutzer): Retention-Fristen-Tabelle im PR mit Speranza GmbH/DSB/Steuerberater abstimmen,
        dann bewusst scharfschalten (Checkliste im PR-Abschnitt "SCHARFSCHALTUNG"). Nichts ist aktiv.
  - [x] A3 Async-Zahlungen/Refunds im Webhook — PR #4 (Draft, `claude/stripe-async-payments`).
        Umgesetzt: async_payment_succeeded/failed, charge.refunded/dispute.created,
        apiVersion bereits einheitlich (2025-08-27.basil). Kartenpfade unverändert.
        TODO (Folge): LexOffice-Storno bei Refund (void-lexoffice-invoice ist admin-auth-gated,
        aus Service-Role-Webhook nicht aufrufbar) → aktuell Operator-Mail; Kunden-Mail bei
        Zahlungs-Fehlschlag fehlt (nur Operator-Alert). Dispute ändert bewusst keinen Status.
        GATE: manuelle Stripe-Test-Mode-Checkliste (SEPA-Erfolg/-Fehlschlag, Dispute, Refunds,
        Idempotenz) + neue Event-Typen am Webhook-Endpoint aktivieren.
- [~] **Track B** — Neuer Stack (B1+B2+B3+B5+B6 stehen; **LIVE deployed + erster echter Login bewiesen 2026-07-05**)
  - [x] B1 Infra-Grundgerüst — Neon-Projekt `events-storia.de` (`soft-lake-86506456`,
        Branch `production`, PG18) via Composio. Schema tenants/tenant_users/inquiries +
        current_user_tenants()-Helfer + FORCE RLS + Seed (tenant-a/tenant-b). Rolle
        `authenticated` auf LOGIN gesetzt (kein BYPASSRLS) → DATABASE_AUTHENTICATED_URL.
        **Neon Auth = Stack Auth** provisioniert (Provider `stack`, Project 4ccda48c-…,
        JWKS live ES256); Better-Auth-Default vorher abgeschaltet. Keys ins Scaffold verdrahtet.
        **LIVE (2026-07-05):** Cloudflare Worker `maestro-api` (Route `tenant-a.schrittmacher.ai/api/*`)
        + Pages `maestro-web` (Custom Domain `tenant-a.schrittmacher.ai`, Same-Origin — Worker-Route hat
        Vorrang vor der Pages-Domain auf gleichem Host, live verifiziert). Neon-Auth-Trusted-Domains
        `https://*.schrittmacher.ai` (Wildcard = alle Mandanten) + `https://tenant-a.schrittmacher.ai`
        per Neon-API via Composio `proxy_execute` gesetzt — Composio hat kein Create-Domain-Tool, und
        der Stack-Server-Key ist KEIN Admin-Key (405/INVALID_SUPER_SECRET_ADMIN_KEY), daher der API-Weg.
        Passwort-Limit: Stack Auth cappt hart bei 70 Zeichen (bcrypt-72-Byte), nicht konfigurierbar.
        **Erster echter Login bewiesen:** `info@monot.com` (sub `5e3a57d5-…`) → tenant_users owner@tenant-a;
        iPhone/5G zeigt „Anfrage A – Sommerfest" live; RLS-Gegenprobe: Tenant-B für ihn = 0 sichtbar.
        OFFEN (kosmetisch): Frontend-Label „Mandant (Dev): tenant-a" — Slug kommt serverseitig korrekt
        aus dem Host; nur die Anzeige liest noch VITE_DEV_TENANT.
  - [x] B2 Isolationsarchitektur entworfen — docs/ARCHITECTURE-MULTITENANCY.md (Opus).
        Kern: Neon RLS (JWT-`sub` via pg_session_jwt) primär + FORCE RLS default-deny;
        einziger DB-Zugang via withTenant(), keine RLS-umgehende Rolle im Request-Pfad;
        Jobs/Webhooks minten tenant-scopedte System-Token; Stripe nur account_id (kein Secret);
        Secrets envelope-encrypted in tenant_secrets; PublicOffer per Subdomain + 128-Bit-Token.
  - [x] B3 Spike bestanden (Cross-Tenant-Test GRÜN) — Scaffold `maestro-cloud` (pnpm-Monorepo:
        packages/db Drizzle+RLS, apps/api Cloudflare-Worker/Hono, apps/web Vite/React/Refine/Stack).
        **End-to-end empirisch verifiziert** über eine DIREKTE `authenticated`-Login-Verbindung
        (exakter Worker-Pfad, gepoolter Endpoint, set_config): A sieht nur A · B nur B · ohne
        Session 0 · Cross-Tenant-Read 0 · Forged-Insert blockiert · 0 Hack-Zeilen. Befund:
        `auth.user_id()` unter `authenticated` rollen-abhängig → Policies lesen `sub` via
        SECURITY-DEFINER-Helfer direkt aus `request.jwt.claims` (sql/05_auth_helper.sql).
        Scaffold an LIVE-Infra verdrahtet (.env/.dev.vars/.env.local), als LIVE-ZIP geliefert.
        **Scaffold baut & ist test-grün**: db/api/web typecheck, `vite build`, `wrangler --dry-run`;
        die scaffold-eigene Test-Suite läuft **9/9 grün gegen die Live-Neon-Branch**. Behobene
        Build-Blocker: @types/node, React 18→19 (Stack-Auth-SDK-Anforderung), jose KeyResolver-Typ,
        StackHandler-Props (kein `navigate` → Offener Punkt #2 aus SDK-Typen gelöst).
        Push blockiert (Git-Proxy) → Scaffold ist eigenes Repo (Git-Historie im ZIP).
  - [x] B4 Data-Provider + **komplette Backoffice-UI portiert (2026-07-05)** — Stitch-Design
        („Premium Hospitality“: Terracotta #C2410C, Source Serif 4 + Inter, Material-3-Tokens,
        Dark Mode) als Tailwind-Design-System in apps/web. AppShell (Sidebar/Topbar/Mobile-Tabbar)
        + 9 Screens, alle LIVE verdrahtet: Übersicht (KPIs/Funnel/Umsatz aus echten Daten),
        Anfragen (Tabs+Drawer+Anlegen; neue PATCH /api/inquiries/:id-Route), Veranstaltungen
        (Liste+Detail mit Status-Stepper/Übergängen/Zahlungen), Angebots-Builder (Optionen A/B/C,
        Positionen in menu_selection-jsonb, Senden→Public-Link), Kunden (CRM+Profil), Zahlungen
        (aggregiert), Kalender (Monat), Einstellungen (Betrieb/Team/Module), Login. Öffentliche
        Angebotsseite /angebot/:token (ohne Login, Option wählen→annehmen). Datenzugriff: dünner
        useApi/apiFetch-Layer (Bearer, Same-Origin). wrangler.toml: Wildcard-Route
        *.schrittmacher.ai/api/* für alle künftigen Mandanten. Web-Build grün, API 48/48 grün.
        Ausgeliefert als maestro-cloud-ui.zip (Deploy = Nutzer: wrangler).
        **2026-07-05 Design-Angleichung (Stitch, pixelnah):** Stitchs EXAKTES Material-3-Token-
        Vokabular als Tailwind-Config + index.css übernommen; AppShell/Kernkomponenten/Dashboard/
        Login von Hand nachgebaut (Login jetzt eigenes Formular via Stack signInWithCredential/
        signInWithOAuth), restliche 9 Seiten per Workflow (9 Agenten, 0 Fehler) an ihre jeweilige
        Stitch-Vorlage angeglichen. Build+Typecheck grün. Offene Datenmodell-Lücken (aus Agenten-
        Feedback, für später): (a) MenuSelection.items nur {section,name} — keine Menge/EP/MwSt pro
        Position → Builder zeigt nur Gesamt + Preis/Person; (b) keine Angebots-Versions-API (Dropdown
        zeigt nur aktuelle Version); (c) Inquiry-Typ ohne occasion/budget-Felder. Stitch-MCP
        (stitch.googleapis.com) via .mcp.json angebunden (STITCH_API_KEY env).
        **CI/CD live (2026-07-05):** GitHub-Repo `dream-anchor/maestro-cloud` → GitHub-Actions
        (.github/workflows/deploy.yml) deployt bei jedem Push auf `main` automatisch Worker + Pages
        nach Cloudflare (via `pnpm exec wrangler`, Secrets CLOUDFLARE_API_TOKEN/ACCOUNT_ID; Token-
        Rechte: Workers Scripts + Pages Edit + Zone Workers Routes Edit). Pages-Production-Branch auf
        `main` gesetzt. Kein manuelles ZIP/wrangler mehr. Erstes Stitch-Design so live ausgeliefert.
  - [~] B5 Auth-Port / Rollen — **Rollenmodell Owner/Admin/Staff pro Mandant, DB-seitig erzwungen**
        (2026-07-04). `ctx.role` in withTenant DB-aufgelöst; rollen-gesicherte Löschungen (Staff→403);
        GET /api/members (Co-Member-Sichtbarkeit tenant-scoped, cross-tenant isoliert). **29/29 Tests
        grün gegen Live-Neon.** Login/Session steht seit B3 (Stack Auth). OFFEN: Einladungs-Flow
        (Stack-Auth-E-Mail-Invite) + Member-Schreiben (add/role-change/remove via Definer-Funktionen).
  - [~] B6 Kern-Workflow portiert — **Kern-Spine als Schema+RLS+API+Tests bewiesen** (2026-07-04).
        Domänen-Analyse ergab: Ziel ist der `v2_*`-Spine (nicht Legacy). Portiert nach Neon +
        Scaffold: `customers → events → offer_options → offer_history` (event_status-Enum, Geld in
        Cents, per-Mandant-eindeutige Keys, FORCE-RLS via Helfer). Worker-Routen /api/customers,
        /api/events(+?status), /api/events/:id/offers, PATCH /api/offers/:id — tenant_id serverseitig,
        customerId-Mandantenprüfung, Angebot nur an eigenes Event.
        **+ Angebot-Versand & Status-Maschine:** POST /api/events/:id/offers/send (friert aktive
        Optionen als offer_history-Snapshot ein, hebt Version, mintet 256-Bit-Public-Token idempotent,
        Status→offer_sent) und POST /api/events/:id/transition (explizite Übergangs-Whitelist,
        lib/event-status.ts; ungültig→409). **18/18 Cross-Tenant-Tests grün gegen Live-Neon**,
        typecheck+wrangler-build grün.
        **+ Öffentliche Angebotsseite (unauth) fertig & bewiesen:** GET /api/public/offer/:token +
        POST .../respond. Sicherheitsmodell: zwei SECURITY-DEFINER-Funktionen (slug+token, Status-Gate)
        + Rolle `maestro_public` OHNE Tabellenrechte (nur EXECUTE); Auth-Gate NUR für /api/public/*
        umgangen. Bewiesen: richtiger (slug,token)=Angebot · falscher Tenant/Slug/Token=404 ·
        Direkt-Tabellenzugriff=denied · fremde Option=400 · Annahme→offer_chosen. **24/24 Tests grün
        gegen Live-Neon.** Damit ist die **Kern-Hauptfunktion end-to-end** (Anfrage→Angebot→Senden→
        Kundenannahme).
        **+ Zahlungs-Fundament bewiesen (Stripe Connect):** `payments`-Tabelle (Cents) + tenant-RLS;
        `tenants.stripe_account_id` (kein Secret gespeichert); Webhook-Rolle `maestro_webhook` (nur
        EXECUTE) + `apply_stripe_payment()` bindet jedes Update an den Connect-Account des Mandanten →
        gefälschtes/fremdes Webhook-Event kann fremde Zahlung NICHT ändern (account_mismatch bewiesen;
        Erfolg → Event→paid). Scaffold fertig: payments-Schema, /api/events/:id/payments (CRUD),
        /api/stripe/webhook (WebCrypto-HMAC-Signaturprüfung, injizierbar; nur DATABASE_WEBHOOK_URL),
        reiner Event→Status-Mapper, Signaturprüfung inkl. **Timestamp-Toleranz (Replay-Schutz)**.
        **48/48 Tests grün gegen Live-Neon.** OFFEN: **Live-Stripe-Keys +
        Checkout-Session-Erzeugung** (Nutzer-Schritt; `// TODO(stripe keys)`),
        LexOffice/IMAP/eSign/KI/WhatsApp (Module, B9/B10),
        Frontend-UI (OfferBuilder etc.).
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
