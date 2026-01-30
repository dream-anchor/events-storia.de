
## Font-Umstellung: Cormorant Garamond → Playfair Display + Great Vibes lokal

### Übersicht

Die aktuelle Didone-Schrift **Cormorant Garamond** wird durch **Playfair Display** ersetzt. Zusätzlich wird **Great Vibes** (Signatur-Schrift) lokal gehostet, um vollständige DSGVO-Konformität zu gewährleisten.

---

### Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `public/fonts/` | Neue Font-Dateien hinzufügen |
| `src/styles/fonts.css` | @font-face Deklarationen aktualisieren |
| `tailwind.config.ts` | Font-Familie anpassen |
| `index.html` | Preload-Links + Google Fonts Referenz entfernen |

---

### Schritt 1: Font-Dateien herunterladen

Die folgenden woff2-Dateien werden benötigt und in `public/fonts/` abgelegt:

**Playfair Display (ersetzt Cormorant Garamond):**
- `PlayfairDisplay-Regular.woff2` (400)
- `PlayfairDisplay-Medium.woff2` (500)
- `PlayfairDisplay-SemiBold.woff2` (600)
- `PlayfairDisplay-Bold.woff2` (700)

**Great Vibes (bisher Google Fonts):**
- `GreatVibes-Regular.woff2` (400)

---

### Schritt 2: fonts.css aktualisieren

```css
/* Playfair Display - Ersetzt Cormorant Garamond */
@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/PlayfairDisplay-Regular.woff2') format('woff2');
}

@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('/fonts/PlayfairDisplay-Medium.woff2') format('woff2');
}

@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url('/fonts/PlayfairDisplay-SemiBold.woff2') format('woff2');
}

@font-face {
  font-family: 'Playfair Display';
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url('/fonts/PlayfairDisplay-Bold.woff2') format('woff2');
}

/* Great Vibes - Jetzt lokal gehostet */
@font-face {
  font-family: 'Great Vibes';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('/fonts/GreatVibes-Regular.woff2') format('woff2');
}

/* Inter bleibt unverändert */
```

---

### Schritt 3: tailwind.config.ts anpassen

```typescript
fontFamily: {
  'serif': ['Playfair Display', 'serif'],  // War: Cormorant Garamond
  'sans': ['Inter', 'sans-serif'],
  'signature': ['Great Vibes', 'cursive'],
},
```

---

### Schritt 4: index.html bereinigen

**Entfernen:**
- Google Fonts preconnect Links (Zeilen 37-38)
- Google Fonts Great Vibes Referenz (Zeilen 48-50)
- Preload für CormorantGaramond (Zeile 45)

**Hinzufügen:**
- Preload für Playfair Display

```html
<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/PlayfairDisplay-Regular.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/fonts/Inter-Regular.woff2" as="font" type="font/woff2" crossorigin />
```

---

### Schritt 5: Alte Font-Dateien aufräumen (optional)

Nach erfolgreicher Umstellung können die alten Cormorant Garamond Dateien entfernt werden:
- `CormorantGaramond-Regular.woff2`
- `CormorantGaramond-Medium.woff2`
- `CormorantGaramond-SemiBold.woff2`
- `CormorantGaramond-Bold.woff2`

---

### Ergebnis

- **100% DSGVO-konform**: Keine externen Google Fonts Verbindungen mehr
- **Playfair Display**: Elegante Didone-Schrift für Überschriften und Fließtext
- **Performance**: Lokales Hosting = schnellere Ladezeiten
- **Konsistenz**: Alle Schriften einheitlich aus `/fonts/` geladen

---

### Technische Hinweise

**Font-Dateien Download:**  
Die woff2-Dateien können von [Google Fonts Helper](https://gwfh.mranftl.com/fonts) oder direkt von [fonts.google.com](https://fonts.google.com) heruntergeladen werden. Ich werde die Dateien für dich bereitstellen.

**Fallback-Kette:**  
Playfair Display → Georgia → serif (Browser-Standard)
