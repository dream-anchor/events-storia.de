
# Plan: Personalisierte E-Mail-Signatur mit Absender-Details

## Übersicht

E-Mails mit Angeboten sollen eine personalisierte Signatur enthalten:
- **Vorname** des aktuellen Admin-Benutzers (Domenico oder Madina)
- **Handynummer** des Absenders
- Vollständige **Firmendetails** (Speranza GmbH)

---

## 1. Mapping-Daten

| E-Mail | Vorname | Handynummer |
|--------|---------|-------------|
| `mimmo2905@yahoo.de` | Domenico | +49 163 6033912 |
| `madi@events-storia.de` | Madina | +49 179 2200921 |
| `madina.khader@gmail.com` | Madina | +49 179 2200921 |

**Firmendetails (statisch):**
```text
Speranza GmbH

Karlstraße 47a
80333 München
Deutschland

Telefon: +49 89 51519696

E-Mail: info@events-storia.de

Vertreten durch die Geschäftsführerin:
Agnese Lettieri

Registereintrag
Eingetragen im Handelsregister des Amtsgerichts München
Handelsregisternummer: HRB 209637

Umsatzsteuer-ID
DE 296024880

Steuernummer
143/182/00980
```

---

## 2. Änderungen

### 2.1 Edge Function: `generate-inquiry-email/index.ts`

**Neues Interface-Feld:**
```typescript
interface InquiryEmailRequest {
  // ... bestehende Felder ...
  senderEmail?: string;  // NEU: E-Mail des Absenders
}
```

**Neues Mapping für Signatur:**
```typescript
const SENDER_INFO: Record<string, { firstName: string; mobile: string }> = {
  'mimmo2905@yahoo.de': { firstName: 'Domenico', mobile: '+49 163 6033912' },
  'madi@events-storia.de': { firstName: 'Madina', mobile: '+49 179 2200921' },
  'madina.khader@gmail.com': { firstName: 'Madina', mobile: '+49 179 2200921' },
};

const COMPANY_FOOTER = `Speranza GmbH

Karlstraße 47a
80333 München
Deutschland

Telefon: +49 89 51519696

E-Mail: info@events-storia.de

Vertreten durch die Geschäftsführerin:
Agnese Lettieri

Registereintrag
Eingetragen im Handelsregister des Amtsgerichts München
Handelsregisternummer: HRB 209637

Umsatzsteuer-ID
DE 296024880

Steuernummer
143/182/00980`;
```

**Änderung am System-Prompt:**
```typescript
// Zeile ~143-147: Aktualisierte Signatur-Anweisung
const senderInfo = SENDER_INFO[senderEmail?.toLowerCase() || ''] || { firstName: 'STORIA Team', mobile: '' };

const systemPrompt = `...
Unterschreibe mit:
"Viele Grüße
${senderInfo.firstName}
${senderInfo.mobile ? senderInfo.mobile : ''}

${COMPANY_FOOTER}"
...`;
```

### 2.2 Frontend: `AIComposer.tsx`

**Aktuellen Benutzer abfragen und mitsenden:**
```typescript
import { supabase } from "@/integrations/supabase/client";

// Im handleGenerateEmail (Zeile ~58-87):
const handleGenerateEmail = useCallback(async () => {
  setIsGenerating(true);
  
  try {
    // NEU: Aktuellen Benutzer abfragen
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase.functions.invoke('generate-inquiry-email', {
      body: {
        // ... bestehende Felder ...
        senderEmail: user?.email,  // NEU
      },
    });
    // ...
  }
});
```

### 2.3 Frontend: `MultiOfferComposer.tsx`

**Gleiche Änderung für die E-Mail-Generierung:**
```typescript
// In generateEmail (Zeile ~106-149):
const generateEmail = async () => {
  // NEU: Aktuellen Benutzer abfragen
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.functions.invoke('generate-inquiry-email', {
    body: {
      // ... bestehende Felder ...
      senderEmail: user?.email,  // NEU
    },
  });
  // ...
};
```

---

## 3. Beispiel-Signatur

Nach der Implementierung endet jede generierte E-Mail so:

```text
Viele Grüße
Domenico
+49 163 6033912

Speranza GmbH

Karlstraße 47a
80333 München
Deutschland

Telefon: +49 89 51519696

E-Mail: info@events-storia.de

Vertreten durch die Geschäftsführerin:
Agnese Lettieri

Registereintrag
Eingetragen im Handelsregister des Amtsgerichts München
Handelsregisternummer: HRB 209637

Umsatzsteuer-ID
DE 296024880

Steuernummer
143/182/00980
```

---

## 4. Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/functions/generate-inquiry-email/index.ts` | Sender-Mapping + personalisierte Signatur im System-Prompt |
| `src/components/admin/refine/InquiryEditor/AIComposer.tsx` | `senderEmail` an Edge-Function senden |
| `src/components/admin/refine/InquiryEditor/MultiOffer/MultiOfferComposer.tsx` | `senderEmail` an Edge-Function senden |

---

## 5. Technische Details

- Das Mapping der E-Mail-Adressen zu Vornamen/Handynummern erfolgt in der Edge-Function (serverseitig)
- Falls ein unbekannter Benutzer die E-Mail generiert, wird "STORIA Team" ohne Handynummer verwendet (Fallback)
- Die Firmendetails sind statisch und werden immer angehängt
- Der AI-Prompt instruiert das Modell, diese exakte Signatur zu verwenden
