## Umsetzung: Archivierte Mails als Original-HTML anzeigen

### Änderungen

**1. Dependencies**
- `dompurify` + `@types/dompurify` zu `package.json` hinzufügen

**2. `src/components/admin/shared/ConversationThread.tsx`**
`MessageBubble` erweitern:
- State `viewMode: 'html' | 'text'` (Default `'html'` falls `body_html` vorhanden, sonst `'text'`)
- **Kollabiert:** unverändert Plain-Text-Preview (3 Zeilen)
- **Expandiert:**
  - Toggle-Pill „Original / Text" oben rechts (nur wenn `body_html` vorhanden)
  - Bei `viewMode='html'`: weißer Container mit `<iframe sandbox="allow-same-origin" srcDoc={DOMPurify.sanitize(body_html)} />`
  - Iframe-Höhe dynamisch via `onLoad` → `contentDocument.body.scrollHeight` (max 800px, dann scrollbar)
  - Bei `viewMode='text'`: aktuelles `<p>`-Rendering mit `body_text`
- Outbound-Bubbles: HTML-Iframe in weißem Container statt direkt auf `bg-primary`

### Was unverändert bleibt
- Real-Time-Subscription, Send-Logik, Edge Functions, DB-Schema
- Plain-Text-Preview im kollabierten Zustand
- `OfferArchivePreview` (nutzt bereits Iframe-srcDoc)

### Erwartetes Ergebnis
Klick auf archivierte Mail in Maestro → expandiert → zeigt **exakt das HTML**, das der Kunde im Postfach sah (Logo, Header, Tabellen, Buttons, Styling). Sandbox verhindert CSS-Leaks ins Maestro-UI. DOMPurify schützt vor schädlichem HTML aus Inbound-Mails. Toggle erlaubt jederzeit Wechsel auf Plain-Text.
