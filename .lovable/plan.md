
# Plan: AI Offer Generator & Manual Inquiry Entry (CRM-Erweiterung)

## Übersicht

Transformation des StoriaMaestro Admin-Dashboards in ein vollwertiges Vertriebs-CRM-Tool: Mitarbeiter können eingehende Anfragen (E-Mail-Text, Notizen) per KI analysieren lassen, automatisch Paket-Vorschläge erhalten und Angebote direkt versenden.

## Workflow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MANUELLER ANGEBOTS-WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. EINGABE                    2. KI-EXTRAKTION              3. ANGEBOT      │
│  ┌──────────────────┐         ┌──────────────────┐         ┌─────────────┐  │
│  │ Kunden-E-Mail    │    →    │ Name, Firma, Tel │    →    │ Pakete +    │  │
│  │ einfügen         │         │ Datum, Gäste     │         │ Artikel     │  │
│  │                  │    KI   │ Paket-Vorschläge │  Admin  │ auswählen   │  │
│  └──────────────────┘         └──────────────────┘         └─────────────┘  │
│                                                                    ↓         │
│                                                             4. VERSAND       │
│                                                             ┌─────────────┐  │
│                                                             │ Speichern & │  │
│                                                             │ E-Mail an   │  │
│                                                             │ Kunden      │  │
│                                                             └─────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Teil 1: Neue Admin-Ansicht "Smart Create"

### Neue Datei: `src/pages/admin/AdminOfferCreate.tsx`

**Split-Screen Layout:**

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                         Manuelle Anfrage erfassen                          │
├────────────────────────────┬───────────────────────────────────────────────┤
│                            │                                               │
│  QUELLE (Rohdaten)         │  ENTWURF (Strukturiert)                       │
│                            │                                               │
│  ┌──────────────────────┐  │  ┌──────────────────────────────────────────┐ │
│  │                      │  │  │ Kontaktdaten                              │ │
│  │  Kunden-E-Mail hier  │  │  │ ├── Name: [____________]                  │ │
│  │  einfügen...         │  │  │ ├── Firma: [___________]                  │ │
│  │                      │  │  │ ├── E-Mail: [__________]                  │ │
│  │  "Sehr geehrtes      │  │  │ └── Telefon: [_________]                  │ │
│  │  STORIA-Team,        │  │  │                                           │ │
│  │                      │  │  │ Event-Details                             │ │
│  │  wir möchten am      │  │  │ ├── Datum: [____.____.____]               │ │
│  │  15. März mit        │  │  │ ├── Uhrzeit: [__:__]                      │ │
│  │  40 Personen         │  │  │ ├── Gäste: [____]                         │ │
│  │  ein Business        │  │  │ └── Art: [Firmendinner ▼]                 │ │
│  │  Dinner feiern..."   │  │  │                                           │ │
│  │                      │  │  │ KI-Vorschläge                             │ │
│  │                      │  │  │ ┌────────────────────────────────────────┐│ │
│  └──────────────────────┘  │  │ │ ✨ Business Dinner – Exclusive (99€)  ││ │
│                            │  │ │    [+ Hinzufügen]                      ││ │
│  ┌──────────────────────┐  │  │ │                                        ││ │
│  │ ✨ Daten & Pakete    │  │  │ │ Erkannte Begriffe: "40 Personen",     ││ │
│  │    extrahieren       │  │  │ │ "Business Dinner", "März"             ││ │
│  └──────────────────────┘  │  │ └────────────────────────────────────────┘│ │
│                            │  │                                           │ │
│                            │  │ Ausgewählte Pakete & Artikel             │ │
│                            │  │ ├── Business Dinner – Exclusive  [x]     │ │
│                            │  │ └── (Artikel aus Katalog wählen...)      │ │
│                            │  │                                           │ │
│                            │  │ ┌──────────┐ ┌─────────────────────────┐ │ │
│                            │  │ │ Speichern│ │ Speichern & Angebot    │ │ │
│                            │  │ │ (Entwurf)│ │ per E-Mail senden       │ │ │
│                            │  │ └──────────┘ └─────────────────────────┘ │ │
│                            │  └──────────────────────────────────────────┘ │
└────────────────────────────┴───────────────────────────────────────────────┘
```

### Routing-Erweiterung

**Datei: `src/pages/RefineAdmin.tsx`**

```typescript
// Neue Route hinzufügen:
<Route path="offers/create" element={<AdminOfferCreate />} />
```

### Komponenten-Struktur

```text
AdminOfferCreate.tsx
├── SourcePanel (links)
│   ├── Textarea für Rohdaten
│   └── "Extrahieren"-Button
│
├── DraftPanel (rechts)
│   ├── ContactDataCard
│   │   └── Formularfelder für Kontakt
│   ├── EventDetailsCard
│   │   └── Datum, Zeit, Gäste, Typ
│   ├── AISuggestionsCard
│   │   ├── Erkannte Pakete
│   │   └── Suchbegriffe
│   ├── PackageSelector
│   │   └── (existiert: EventModules/CateringModules)
│   └── ActionButtons
│       ├── Speichern (Entwurf)
│       └── Speichern & E-Mail senden
```

---

## Teil 2: KI-Parsing Edge Function

### Neue Datei: `supabase/functions/parse-inquiry-text/index.ts`

**Aufgabe:** Extrahiert strukturierte Daten aus Freitext (E-Mail, Notizen)

**Input:**
```typescript
interface ParseInquiryRequest {
  rawText: string;
  existingPackageNames: string[];  // Für Matching
  existingMenuItems: string[];     // Für Matching
}
```

**Output (via Tool-Calling):**
```typescript
interface ParsedInquiry {
  // Kontaktdaten
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  
  // Event-Details
  preferred_date: string | null;  // ISO-Format
  preferred_time: string | null;
  guest_count: string | null;
  event_type: string | null;
  
  // Paket-Erkennung
  suggested_packages: {
    name: string;
    confidence: 'high' | 'medium' | 'low';
    matched_keywords: string[];
  }[];
  
  // Artikel-Erkennung (für Catering)
  suggested_items: {
    search_term: string;
    context: string;
  }[];
  
  // Ursprüngliche Nachricht (für Notizen)
  original_message_summary: string;
}
```

**System-Prompt (Kern-Logik):**

```text
Du bist ein intelligenter Parser für Event- und Catering-Anfragen des Restaurants STORIA München.

DEINE AUFGABE:
1. Extrahiere Kontaktdaten (Name, Firma, E-Mail, Telefon) aus dem Text
2. Erkenne Event-Details (Datum, Uhrzeit, Gästezahl, Art des Events)
3. Identifiziere gewünschte Produkte/Pakete

PAKET-ERKENNUNG (WICHTIG):
Analysiere den Text auf folgende Schlüsselwörter und ordne sie unseren Paketen zu:

"Aperitif", "Networking", "Standing", "Fingerfood" → Network Aperitivo
"Dinner", "Abendessen", "Menü", "3-Gang", "4-Gang" → Business Dinner – Exclusive
"ganze Location", "exklusiv", "Buyout" → Full Buyout
"Buffet", "Catering", "Lieferung" → Catering-Anfrage (kein Paket)

Erkenne auch Mengen (z.B. "40 Personen") und Datumsangaben.
```

---

## Teil 3: Produkt-Selektor mit KI-Vorschlägen

### Komponente: `AISuggestionsCard.tsx`

```typescript
interface AISuggestionsCardProps {
  suggestions: ParsedInquiry['suggested_packages'];
  onAddPackage: (packageName: string) => void;
  searchTerms: string[];
  onSearch: (term: string) => void;
}
```

**UI-Design:**

```text
┌───────────────────────────────────────────────────┐
│ ✨ KI-Vorschläge                                  │
├───────────────────────────────────────────────────┤
│                                                   │
│ Hohe Übereinstimmung:                            │
│ ┌───────────────────────────────────────────────┐│
│ │ 🎯 Business Dinner – Exclusive                ││
│ │    Erkannt: "Dinner", "40 Personen"           ││
│ │    [+ Zum Angebot hinzufügen]                 ││
│ └───────────────────────────────────────────────┘│
│                                                   │
│ Mögliche Matches:                                │
│ ┌───────────────────────────────────────────────┐│
│ │ 🤔 Network Aperitivo                          ││
│ │    Erkannt: "Networking" im Text              ││
│ │    [+ Hinzufügen]  [🔍 Mehr Info]             ││
│ └───────────────────────────────────────────────┘│
│                                                   │
│ Suchbegriffe (manuell suchen):                   │
│ ┌─────────┐ ┌──────────┐ ┌─────────────┐        │
│ │ Buffet  │ │ März     │ │ vegetarisch │        │
│ └─────────┘ └──────────┘ └─────────────┘        │
│                                                   │
└───────────────────────────────────────────────────┘
```

---

## Teil 4: Speichern & E-Mail-Versand

### Workflow

```text
┌─────────────────────────────────────────────────────────────────┐
│                    SPEICHER-WORKFLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "Speichern (Entwurf)"                                          │
│  ─────────────────────                                          │
│  1. Erstellt neuen Eintrag in event_inquiries                   │
│  2. Status: 'new'                                               │
│  3. Speichert: Kontakt, Event-Details, Quote-Items              │
│  4. Toast: "Anfrage gespeichert"                                │
│  5. Redirect → /admin/events/:id/edit (SmartInquiryEditor)      │
│                                                                  │
│  "Speichern & Angebot senden"                                   │
│  ─────────────────────────────                                  │
│  1. Speichert wie oben                                          │
│  2. Generiert E-Mail-Text via generate-inquiry-email            │
│  3. Erstellt LexOffice-Angebot via create-event-quotation       │
│  4. Sendet E-Mail an Kunden                                     │
│  5. Status: 'offer_sent'                                        │
│  6. Toast: "Angebot wurde an [email] versendet"                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### E-Mail-Inhalt

Die bestehende `send-order-notification` Edge Function wird erweitert oder eine neue `send-offer-email` erstellt:

```text
════════════════════════════════════════════
          STORIA · ANGEBOT
════════════════════════════════════════════

Guten Tag [Kundenname],

vielen Dank für Ihre Anfrage für ein [Event-Typ] 
am [Datum] mit [Gästezahl] Personen.

Anbei finden Sie unser Angebot:

────────────────────────────────────────────
IHRE AUSWAHL
────────────────────────────────────────────
  1x Business Dinner – Exclusive
     40 Personen × 99,00€ = 3.960,00€
     
────────────────────────────────────────────
GESAMTSUMME:                    3.960,00€
────────────────────────────────────────────

Zur Buchung klicken Sie hier:
[JETZT BUCHEN] → https://events-storia.de/checkout?inquiry=xxx

...
```

---

## Technische Implementierung

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `src/pages/admin/AdminOfferCreate.tsx` | Haupt-View für manuelle Erfassung |
| `src/components/admin/refine/OfferCreate/SourcePanel.tsx` | Textarea für Rohdaten |
| `src/components/admin/refine/OfferCreate/DraftPanel.tsx` | Strukturiertes Formular |
| `src/components/admin/refine/OfferCreate/AISuggestionsCard.tsx` | KI-Vorschläge UI |
| `src/components/admin/refine/OfferCreate/ContactDataCard.tsx` | Kontaktformular |
| `src/components/admin/refine/OfferCreate/EventDetailsCard.tsx` | Event-Details |
| `supabase/functions/parse-inquiry-text/index.ts` | KI-Parsing Edge Function |
| `supabase/functions/send-offer-email/index.ts` | E-Mail-Versand für Angebote |

### Bestehende Dateien (Erweiterungen)

| Datei | Änderung |
|-------|----------|
| `src/pages/RefineAdmin.tsx` | Route für `/admin/offers/create` |
| `src/components/admin/refine/Dashboard.tsx` | Quick-Action Button "Neue Anfrage" |
| `src/components/admin/refine/FloatingPillNav.tsx` | Neuer Tab "Anfrage erstellen" |
| `supabase/config.toml` | Neue Edge Functions registrieren |

### Datenbank

Keine Schema-Änderungen erforderlich - die bestehende `event_inquiries` Tabelle hat alle benötigten Felder:
- `contact_name`, `company_name`, `email`, `phone`
- `preferred_date`, `guest_count`, `event_type`
- `selected_packages` (JSONB), `quote_items` (JSONB)
- `status`, `email_draft`

---

## Edge Function: parse-inquiry-text

```typescript
// Kern-Logik (vereinfacht)
const systemPrompt = `Du analysierst Anfragen für das Restaurant STORIA München.

Extrahiere folgende Informationen aus dem Text:
1. Kontaktdaten (Name, Firma, E-Mail, Telefon)
2. Event-Details (Datum, Uhrzeit, Gästezahl, Art)
3. Paket-Hinweise basierend auf Schlüsselwörtern

PAKET-MAPPING:
- "Aperitivo", "Networking", "Standing" → Network Aperitivo
- "Dinner", "Abendessen", "Menü" → Business Dinner
- "Location", "exklusiv" → Full Buyout
- "Catering", "Lieferung" → Catering-Anfrage

Antworte NUR mit dem strukturierten Tool-Call.`;

// Tool Definition für structured output
const tools = [{
  type: "function",
  function: {
    name: "extract_inquiry_data",
    parameters: {
      type: "object",
      properties: {
        contact_name: { type: "string" },
        company_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        preferred_date: { type: "string" },
        guest_count: { type: "string" },
        event_type: { type: "string" },
        suggested_packages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              matched_keywords: { type: "array", items: { type: "string" } }
            }
          }
        }
      }
    }
  }
}];
```

---

## Integration mit bestehendem System

### Nahtlose Übergabe an SmartInquiryEditor

Nach dem Speichern wird der Nutzer zu `/admin/events/:id/edit` weitergeleitet, wo der volle SmartInquiryEditor greift:
- Kalkulation (Pakete, Artikel, Preise)
- Kommunikation (AIComposer, E-Mail-Templates)
- Multi-Offer-Optionen

### Wiederverwendung bestehender Komponenten

- `useCombinedMenuItems` für Artikel-Suche
- `useList` für Paket-Daten
- `AIComposer` für E-Mail-Generierung
- `create-event-quotation` für LexOffice

---

## Zusammenfassung

| Schritt | Komponente | Funktion |
|---------|------------|----------|
| 1 | AdminOfferCreate | Split-Screen UI |
| 2 | parse-inquiry-text | KI-Extraktion |
| 3 | AISuggestionsCard | Paket-Vorschläge |
| 4 | PackageSelector | Manuelle Auswahl |
| 5 | Speichern | → event_inquiries |
| 6 | send-offer-email | E-Mail an Kunde |

**Ergebnis:** Ein vollständiges CRM-Workflow-Tool, das manuelle Anfragen effizient in strukturierte Angebote umwandelt und versendet.
