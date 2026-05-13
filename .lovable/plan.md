## Zwei separate Probleme

### 1) Maestro: weiße Seite auf dem Smartphone (events-storia.de/admin)

**Befund**
- `/admin/login` rendert in der Preview problemlos (Login-Form sichtbar bei 390×844) und auch auf der Live-Domain `events-storia.de/admin`.
- Wenn du **eingeloggt** bist und `/admin` aufrufst, lädt das Maestro-Dashboard korrekt (per Mobile-Screenshot bestätigt).
- Wahrscheinlichste Ursache der weißen Seite auf deinem Handy: **veralteter Service-Worker / Browser-Cache** — die letzte Mobile-Korrektur ist live, aber dein iPhone hält noch alte JS-Bundles, die mit dem neuen CSS kollidieren und beim Mount crashen.

**Vorgeschlagene Aktionen**
- Cache-Busting verstärken: in `index.html` einen `<meta http-equiv="Cache-Control" content="no-cache">` für die Admin-Route ergänzen und sicherstellen, dass kein alter Service-Worker (`sw.js`) registriert ist (in `src/main.tsx` ein einmaliges `navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))` für `/admin` einbauen).
- AdminLayout absichern: Defensive Try/Catch im `useEffect` für `document.body.classList.add('admin-active')` und User-Fetch, damit ein einzelner Fehler nicht den gesamten Tree umlegt.
- `body.admin-active` Hintergrund explizit auf `#f6f7f8` setzen (statt nur `hsl(220 14% 96%)`), passend zum `.admin-layout`-Container — verhindert weißes Flash zwischen Mount und CSS-Apply.
- Erbitten: bitte einmal auf dem iPhone „Verlauf & Webseitendaten löschen" (Safari → Einstellungen) und dann erneut testen. Wenn das schon hilft, ist die Cache-Hypothese bestätigt und die obigen Schutzmaßnahmen verhindern das Wiederauftreten.

### 2) Public Offer: „Fehler beim Erstellen der Zahlungssitzung"

**Befund**
- Edge-Function `create-payment-session` läuft sauber: direkter cURL-Test gegen die Anfrage Lagourrès (`90321866-…`) liefert `200 OK` und gültige Stripe-Checkout-URL — sowohl im Single-Option- als auch im Multi-Option-Pfad.
- Das Frontend ruft die Function über `supabase.functions.invoke()` auf. Diese Methode hängt automatisch den Auth-Header an. **In der Lovable-Preview-Umgebung kann der Fetch-Proxy genau diesen Aufruf abfangen und brechen** (bekannter Lovable-Preview-Bug bei Supabase-Auth-Calls). Auf der publizierten URL `events-storia.de` tritt das nicht auf.
- Sekundär möglich: Das angesteuerte Angebot hat keine Option (siehe `95995bb6-…` und `9ba811ab-…` in der DB — beide ohne `inquiry_offer_options`). In dem Fall liefert die Function bewusst `400 — optionId ist erforderlich`.

**Vorgeschlagene Aktionen**
- Robusterer Frontend-Aufruf: in `PublicOffer.tsx` (Zeilen 776 & 1445) und `ProposalView.tsx` (Zeile 182) statt `supabase.functions.invoke` einen direkten `fetch` auf `${VITE_SUPABASE_URL}/functions/v1/create-payment-session` mit `apikey` + `Content-Type` Headern verwenden. Das umgeht den Preview-Proxy und funktioniert in Preview wie in Produktion identisch.
- Bessere Fehlermeldung: Wenn die Function `400 — optionId ist erforderlich` liefert, dem Kunden sagen „Bitte erst eine Menü-Option auswählen" statt der generischen Sitzungs-Fehlermeldung.
- Guard im UI: Wenn `options.length === 0`, den Zahlen-Button gar nicht anzeigen, sondern Hinweistext „Angebot enthält keine Optionen — bitte Storia kontaktieren".
- Verifikation: Nach dem Deploy einmal in der Preview UND auf events-storia.de den Zahlen-Button für die Lagourrès-Anfrage drücken und bestätigen, dass Stripe Checkout öffnet.

## Technische Details

```text
src/pages/PublicOffer.tsx          Zeilen 776, 1445 → fetch statt invoke
src/pages/public-offer/
  ├── ProposalView.tsx             Zeile 182 → fetch statt invoke
  └── FinalOfferView.tsx           Zeile 111 → fetch statt invoke
src/components/admin/refine/
  └── AdminLayout.tsx              Try/Catch um useEffect-Bodies
src/index.css                      body.admin-active → bg #f6f7f8
src/main.tsx                       SW-Unregister Cleanup
index.html                         no-cache Meta für Admin
```

Keine DB-Migration nötig. Keine Änderung an der Edge-Function (läuft korrekt).
