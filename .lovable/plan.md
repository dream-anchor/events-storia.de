## Ziel
Sprachumschalter auf der Public-Offer-Seite entfernen. Die Sprache des Kunden ist bereits über `customer_language` in der Anfrage bekannt; die Seite zeigt den Inhalt immer in der Kundensprache (Fallback: EN).

## Änderungen

### `src/pages/PublicOffer.tsx`
1. **Import bereinigen**: `OFFER_LANGS` und `OFFER_LANG_LABELS` aus dem Import von `@/lib/offerLang` entfernen.
2. **Sprachumschalter-Rendering entfernen**: Den Aufruf `<OfferLanguageSwitcher lang={lang} onChange={setLang} />` aus dem JSX entfernen (Zeile ~496–499).
3. **Komponente `OfferLanguageSwitcher` löschen**: Die gesamte Funktionsdefinition (Zeile ~2225–2258) entfernen.
4. **Sprachlogik unverändert lassen**: Die bestehende Ableitung `lang` aus `customer_language` mit Fallback `en` sowie der `?lang=`-Query-Parameter-Override für Admin-Vorschauen bleiben erhalten.