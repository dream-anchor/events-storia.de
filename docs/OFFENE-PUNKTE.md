# MAESTRO — Offene Punkte & Backlog (living doc)

> Zentrale Merkliste über Sessions hinweg. Ergänzt die Entscheidungs-Agenda in
> `docs/specs/00-ROADMAP.md`. Stand: 2026-07-06.

## A. Betriebs-To-Dos — nur Antoine kann das erledigen
1. **Bundle einspielen:** jeweils neuestes `maestro-cloud-*.bundle` im lokalen `maestro-cloud`
   (`git fetch ./…bundle HEAD && git merge FETCH_HEAD && git push`) → CI deployt automatisch.
2. **GitHub-Zugriff:** Claude-GitHub-App Zugriff auf das `maestro-cloud`-Repo geben, damit
   künftige Sessions direkt pushen können (dann entfällt der Bundle-Umweg).

## A2. Integrationen laufen über Composio (2026-07-06 bestätigt)
Anthropic, LexOffice, Resend, Stripe sind **in Composio ACTIVE** verbunden — keine rohen
Provider-Keys nötig. **Offene Entscheidung (siehe B):** ob das Produkt zur Laufzeit über
Composio geht (ein `COMPOSIO_API_KEY` im Worker, pro Mandant eine Composio-Verbindung) oder
direkte Provider-Keys nutzt. Für Storia als ersten Mandanten funktioniert beides.
- ⚠️ **Stripe = per Mandant** (Connect / eigene Konten) — eine einzelne Composio-Verbindung
  reicht nur für Storia; Multi-Tenant braucht Verbindung/Connect je Betrieb.
- ⚠️ **LexOffice = per Mandant** — jeder Betrieb hat sein eigenes Konto.
- **Freigabe ausstehend:** einmaliger Test-Entwurf in LexOffice zum Golden-Beweis von F8.

## B. Offene Entscheidungen (Default-Empfehlung in Klammern)
Referenz-Nummern = `00-ROADMAP.md`.
- **#3 EU-KI-Processing / AVV** — ⚠️ **GATE vor echtem KI-Kundenbetrieb.** Anthropic ist als
  Default verdrahtet; AVV + EU-Flag müssen vor Verarbeitung echter Kundendaten stehen.
  *(First-Party + EU-Flag, AVV vor Vertrieb)*
- #1 Sending-Domain *(Resend + Plattform-Subdomain, eigene Domain im Pro-Tier)*
- #2 PDF-Provider *(Cloudflare Browser Rendering zuerst)*
- #4 Follow-up-Kadenz / Auto-Send-Schwelle *(T+3/T+7, < 1.000 € automatisch, Auto-Send MVP aus)*
- #5 Anzahlung Pflicht? *(Default an, abschaltbar)*
- #10 „Räume"-Screen ausblendbar *(pro Tenant-Setting)*
- #12 Storia-Datenmigration Zeitpunkt *(Dry-Run jetzt, scharf nach MVP)*
- #13 WORM-Aufbewahrung *(gewonnen 10 J., nicht gewonnen 12 Mon.)*
- #14 KI-Kosten-Kontingent *(Inklusiv-Kontingent + transparenter Cent-Preis)*

**Bereits entschieden (2026-07-06):** #6 Angebots-Optionen 1/max 3 · #7 Preisanpassung sichtbar
(im Builder als `section='adjustment'`) · #8 Brutto zuerst · #9 Kern DE+EN · #11 KI-Import nur Karten.

## C. Bewusst zurückgestellte Bau-Teile (kommen später, blockieren nichts)
- **Spec 06 F4/F5 — Externes Widget:** Hosted Page `karte.maestro.app` + Web Component.
  Braucht Domain-/CDN-Entscheidung. Backend-Katalog/Import steht bereits.
- **Spec 06 F6 — Übersetzungs-Pass:** separater KI-Call je Zielsprache mit Kopie-Gate.
- **Spec 06 — Queue-Entkopplung** des Parse (aktuell inline; für < 100 Positionen ausreichend).
- **Spec 02 Backlog:** Echtzeit-Co-Editing/Presence, Delta-Payloads, Live-Add-on-Neuberechnung
  auf der Public-Seite.

## D. Umsetzungs-Status (Kurzüberblick)
- ✅ **Spec 01 Katalog** — umgesetzt + live verifiziert.
- ✅ **Spec 06 Import (F1–F3)** — Karte → KI → Review → Katalog, verifiziert.
- 🔨 **Spec 02 Angebots-Builder** — F1 Engine + F2 Datenmodell + F3 API + **F4 Editor-UI** +
  **F7 Kundenseite** umgesetzt+verifiziert (**84/84 Tests, E2E bauen→senden→öffentlich lesen**).
  **F8 LexOffice-Mapping** umgesetzt+unit-verifiziert (Cent-Paritaet by construction);
  **offen:** echter Golden-Test via Composio `LEXOFFICE_CREATE_QUOTATION` (Freigabe nötig) +
  Transport-Anbindung. **Offen:** **F9 KI** (ai-suggest/parse-freeform), F10 Nordstern/Queue.
- ⏭️ danach: 04 Dokumente/PDF · 03 Versand/Annahme · 05 KI-Gateway-Ausbau · P2–P5.

## E. Technische Merkposten (im Code hinterlegt)
- **Zielpreis-Anpassung USt:** die Anpassungszeile bekommt aktuell den größten vorhandenen
  USt-Bucket bzw. 19 % als Fallback. Sobald `tenant_settings` existiert → dort den Standardsatz
  des Mandanten ziehen (Spec 02 D.4).
- **Parse inline statt Queue** (Spec 06) — für < 100 Positionen ok; Queue später.
