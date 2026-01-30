
# Plan: Mitarbeiternamen vollständig anzeigen – "Antoine Monot" statt "monot"

## Übersicht

Aktuell wird der Benutzer `monot@hey.com` als "Domenico" (mit Initialen "DS") angezeigt. Das ist falsch – der korrekte Name lautet **Antoine Monot** (Initialen "AM").

Zusätzlich sind die Mitarbeiter-Namens-Mappings über 7+ Dateien verstreut, was zu Inkonsistenzen führt. Diese werden in eine zentrale Utility-Datei konsolidiert.

---

## Schritt 1: Zentrale Admin-Utilities erstellen

Neue Datei `src/lib/adminDisplayNames.ts` mit allen Mitarbeiter-Mappings:

```text
Alle bekannten Admins:
┌─────────────────────────────────────────────────────────────────┐
│ E-Mail                     │ Vollständiger Name  │ Initialen   │
├────────────────────────────┼─────────────────────┼─────────────┤
│ monot@hey.com              │ Antoine Monot       │ AM          │
│ mimmo2905@yahoo.de         │ Domenico Speranza   │ DS          │
│ nicola@storia.de           │ Nicola Speranza     │ NS          │
│ madi@events-storia.de      │ Madina Khader       │ MK          │
│ madina.khader@gmail.com    │ Madina Khader       │ MK          │
│ info@storia.de             │ Storia Team         │ ST          │
└─────────────────────────────────────────────────────────────────┘

Exportierte Funktionen:
- getAdminDisplayName(email): string → Vollständiger Name
- getAdminInitials(email): string → Initialen (2 Buchstaben)
- getAdminFirstName(email): string → Vorname für E-Mail-Signaturen
```

---

## Schritt 2: Betroffene Dateien aktualisieren

| Datei | Änderung |
|-------|----------|
| `src/lib/adminDisplayNames.ts` | **NEU** – Zentrale Mapping-Datei |
| `src/components/admin/shared/EditorIndicator.tsx` | Import zentrales Mapping, "Antoine Monot" statt "Domenico" |
| `src/components/admin/shared/Timeline.tsx` | Import zentrales Mapping |
| `src/components/admin/shared/UserProfileDropdown.tsx` | Import zentrales Mapping |
| `src/providers/refine-auth-provider.ts` | Import zentrales Mapping |
| `src/components/admin/refine/EventsList.tsx` | Ersetze `email.includes('mimmo')` durch Lookup |
| `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx` | Ersetze lokales `getDisplayName` |
| `supabase/functions/generate-inquiry-email/index.ts` | Füge `monot@hey.com` → "Antoine" hinzu |

---

## Schritt 3: Edge Function E-Mail-Signaturen

Die Edge Function `generate-inquiry-email` verwendet Vornamen für E-Mail-Signaturen. Antoine Monot wird hinzugefügt:

```text
SENDER_INFO erweitern:
+ 'monot@hey.com': { firstName: 'Antoine', mobile: '[zu erfragen]' }
```

**Hinweis:** Falls Antoine Monot keine personalisierte E-Mail-Signatur benötigt, kann dieser Eintrag weggelassen werden (Fallback auf Standard-Signatur).

---

## Vorher → Nachher

```text
EditorIndicator (kompakt):
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ [DS] vor 5 Min.             │ →   │ [AM] vor 5 Min.             │
│ Tooltip: "Domenico"         │     │ Tooltip: "Antoine Monot"    │
└─────────────────────────────┘     └─────────────────────────────┘

Timeline:
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ von monot                   │ →   │ von Antoine Monot           │
└─────────────────────────────┘     └─────────────────────────────┘

EventsList Status:
┌─────────────────────────────┐     ┌─────────────────────────────┐
│ "von monot"                 │ →   │ "von Antoine Monot"         │
└─────────────────────────────┘     └─────────────────────────────┘
```

---

## Technische Details

### Neue Utility-Datei: `src/lib/adminDisplayNames.ts`

```typescript
// Zentrale Admin-Konfiguration
interface AdminInfo {
  fullName: string;
  firstName: string;
  initials: string;
  mobile?: string;
}

const ADMIN_REGISTRY: Record<string, AdminInfo> = {
  'monot@hey.com': { 
    fullName: 'Antoine Monot', 
    firstName: 'Antoine', 
    initials: 'AM' 
  },
  'mimmo2905@yahoo.de': { 
    fullName: 'Domenico Speranza', 
    firstName: 'Domenico', 
    initials: 'DS',
    mobile: '+49 163 6033912'
  },
  // ... weitere Einträge
};

export function getAdminDisplayName(email?: string | null): string;
export function getAdminInitials(email?: string | null): string;
export function getAdminFirstName(email?: string | null): string;
```

### Komponenten-Import-Muster

```typescript
// Vorher (in jeder Datei dupliziert)
const ADMIN_DISPLAY_NAMES = { ... };
const getDisplayName = (email) => ...;

// Nachher (zentraler Import)
import { getAdminDisplayName, getAdminInitials } from '@/lib/adminDisplayNames';
```

---

## Zusammenfassung

- **1 neue Datei:** Zentrale Admin-Utilities
- **7 Dateien aktualisiert:** Alle verwenden jetzt die zentrale Quelle
- **Korrektur:** `monot@hey.com` = "Antoine Monot" (AM)
- **Bonus:** Kein duplizierter Code mehr, einfache Wartung bei neuen Mitarbeitern
