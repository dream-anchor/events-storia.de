# Warenkorb auf Restzahlungs-Seiten ausblenden

## Hintergrund
In `src/App.tsx` gibt es bereits eine zentrale Logik (`FrontendGlobals`), die den Warenkorb (CartButton, StickyCartPanel, CartSheet) auf bestimmten Routen ausblendet. Aktuell ausgenommen sind nur:

- `/offer/...`
- `/ihr-angebot/...`
- `/your-offer/...`

Die neuen Restzahlungs-Seiten (`/restzahlung/:slug` und `/en/balance-payment/:slug`) sind dort **nicht** enthalten, daher wird der Warenkorb dort fälschlich angezeigt.

## Änderung
In `src/App.tsx` die `isOfferRoute`-Bedingung erweitern um:

- `/restzahlung/`
- `/en/balance-payment/`

Damit greift exakt dieselbe „Kein Warenkorb"-Logik wie bei den Public-Offer-Seiten. Google Analytics, Cookie-Banner und Cookie-Settings bleiben erhalten.

## Antwort auf die Frage
**Ja** — die Logik ist zentral in `FrontendGlobals` gebündelt. Sobald die Restzahlungs-Routen dort eingetragen sind, ist der Warenkorb **auf allen** Restzahlungs-Seiten (jeder Slug, DE und EN) automatisch ausgeblendet. Public-Offer-Seiten waren bereits abgedeckt.

## Nicht betroffen
- Keine Änderung am Warenkorb selbst, am Shop oder an anderen Seiten
- Keine Änderung an `Restzahlung.tsx` nötig
- Keine DB- oder Edge-Function-Änderung
