# Phase 4 — Optionale Pakete-Hint-Sektion in Step 3

**Status:** PARKED. Frühestens umsetzen, wenn Phase 1+2+3 stabil produktiv laufen
und mindestens 30 Tage echte Lead-Daten in `leads_funnel` vorliegen.

## Ziel
Step 3 (Format) erweitern um sekundäre, **optionale** Sektion „Bekanntes Wunschpaket?"
mit den 5 Catering-Paketen aus `static-menus.json`. Hauptauswahl Format bleibt
unverändert. Pakete-Sektion ist KEIN Pflichtfeld.

## DB-Erweiterung (additiv, nullable)
```sql
ALTER TABLE public.leads_funnel
  ADD COLUMN IF NOT EXISTS preferred_package TEXT;

ALTER TABLE public.leads_funnel
  ADD CONSTRAINT leads_funnel_preferred_package_check
  CHECK (preferred_package IS NULL OR preferred_package IN (
    'buffet-fingerfood',
    'buffet-platten',
    'buffet-auflauf',
    'pizze-napoletane',
    'desserts'
  ));
```

## Frontend
In `src/pages/anfrage/funnel/Step3_Format.tsx` unter der Format-Auswahl:

- Headline: „Bereits ein Wunschpaket im Kopf?"
- Subline: „Optional — wir besprechen Details gemeinsam."
- 6 Cards/Pills in 2 Reihen:
  - Fingerfood-Paket — ab 25 € p.P. → `buffet-fingerfood`
  - Platten & Sharing — ab 32 € p.P. → `buffet-platten`
  - Warme Gerichte — ab 38 € p.P. → `buffet-auflauf`
  - Pizza Napoletana — ab 22 € p.P. → `pizze-napoletane`
  - Desserts ergänzend — ab 8 € p.P. → `desserts`
  - Lieber individuelle Beratung → `null` (default)
- Pro Card rechts: Link „→ ansehen" → `events-storia.de/menu/{slug}` (neuer Tab)

Preise aus `static-menus.json` lesen oder als manuelle Konstante in
`/src/pages/anfrage/funnel/packageHints.ts`.

State in `funnel/types.ts`:
```ts
type PackageSlug =
  | "buffet-fingerfood" | "buffet-platten" | "buffet-auflauf"
  | "pizze-napoletane"  | "desserts";

preferred_package: PackageSlug | null;
```

## Submit (FunnelShell.tsx)
Payload erweitern um:
```ts
preferred_package: state.preferred_package ?? null
```

## Edge Function (`lead-notify-funnel`)
- **Interne Mail:** Zeile „Wunschpaket: …" nur wenn gesetzt. Mapping:
  - `buffet-fingerfood` → „Fingerfood-Paket"
  - `buffet-platten`    → „Platten & Sharing"
  - `buffet-auflauf`    → „Warme Gerichte"
  - `pizze-napoletane`  → „Pizza Napoletana"
  - `desserts`          → „Desserts ergänzend"
- **Auto-Reply:** Paket NICHT erwähnen.

## Tests
- Ohne Paket-Auswahl: `preferred_package=null`, interne Mail ohne Paket-Zeile.
- Mit „Fingerfood-Paket": `preferred_package="buffet-fingerfood"`, interne Mail
  zeigt „Wunschpaket: Fingerfood-Paket".
- `intent=consult` überspringt Step 3, `preferred_package` bleibt `null`.

## Nicht ändern
Validation, Score-Berechnung, Auto-Reply.

## Auswertung (manuell durch Antoine)
Nach 30 Tagen: Verteilung Anlass × People-Bucket × Paket, Korrelation mit
`lead_score`. Keine zusätzliche Code-Erweiterung dafür nötig.