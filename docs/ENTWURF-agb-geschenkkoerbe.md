# ENTWURF — AGB-Teil „Geschenkkörbe“ und Widerruf (NICHT LIVE, nicht anwaltlich geprüft)

Stand: 20.11.2026 · Status: **Entwurf zur Prüfung durch den Anwalt (Antoine klärt den Wortlaut, Entscheidungen 20.11.2026 Punkt 8 + 9).**
Nichts davon ist in `src/content/agb-2026-10.json`, `Widerrufsbelehrung.tsx` oder die Shop-Seiten eingebaut. Der Shop zeigt bis zur
Freigabe keine Bestellungen (Server-Env `GIFT_LEGAL_APPROVED`, Status ans Frontend über die Function `gift-shop-config`). Die kurzen Hinweistexte im Shop
und in den Mails stehen ebenfalls dort (an einer Stelle) und sind dieselben wie unten in § 24e/§ 24f.

**Livegang des Geschenkkorb-Shops erst mit: (1) vollständigen LMIV-Angaben (Etikettenfotos von Antoine), (2) freigegebenen Rechtstexten
(dieser Entwurf nach Anwaltsprüfung), (3) Steuer-Aufteilung 7 %/19 % vom Steuerberater, (4) bestätigten Abholzeiten/Ladenschluss.**

## Entscheidung Antoine (20.11.2026, ersetzt Punkt 9)
Bei Geschenkkörben gilt das **gesetzliche Widerrufsrecht (14 Tage ab Erhalt der Ware)**; der Kunde trägt die Rücksendekosten; ausgenommen sind **geöffnete versiegelte Lebensmittel** (§ 312g Abs. 2 Nr. 3 BGB). Kurzhinweis im Shop und in den Mails mit Link auf Widerrufsbelehrung und AGB § 41; es gibt keine Checkbox „Verzicht auf Widerruf“. (Die früher vorgesehene Fassung „Widerruf nur bis Abholung“ ist entfallen; Risiko 1 unten ist damit im Kern erledigt.)

## Rechtliche Risiken, die der Anwalt klären muss (nicht von uns entscheidbar)
1. **Beginn der Widerrufsfrist (§ 356 Abs. 2 Nr. 1 BGB):** Bei Warenlieferung beginnt die Frist erst mit Erhalt der Ware und läuft 14 Tage danach.
   Ein vertraglicher Ausschluss „nach Übergabe keine Rücknahme“ ist für den Verbraucher **nicht ohne Weiteres wirksam**, solange kein
   gesetzlicher Ausschlussgrund greift (§ 312g Abs. 2 BGB). Zu prüfen: Nr. 2 (schnell verderbliche Waren / rasch überschrittenes Verfallsdatum —
   gilt für haltbare Körbe voraussichtlich nicht für alle Bestandteile), Nr. 3 (versiegelte Waren, die aus Gründen des Gesundheitsschutzes/der
   Hygiene nicht zur Rückgabe geeignet sind, wenn die Versiegelung nach der Lieferung entfernt wurde — Lebensmittel), Nr. 1 (nach Kundenspezifikation
   angefertigt — nur bei individualisierter Zusammenstellung). Möglicher Weg: (Entschieden 20.11.2026: gesetzliches Widerrufsrecht mit Ausschluss geöffneter versiegelter Lebensmittel, siehe oben.)
2. **Abholung im Geschäft:** Wird bei Abholung vor Ort übergeben, ist die Frage, ob überhaupt ein Fernabsatzvertrag mit Widerrufsrecht für die
   Zeit nach Übergabe besteht (Vertragsschluss online = Fernabsatz, Übergabe vor Ort ändert das nicht automatisch).
3. **Alkohol/Jugendschutz (§ 9 JuSchG):** Abgabe von Wein/Crémant ab 16. Altersprüfung bei Übergabe vertraglich regeln; reine Checkbox reicht bei
   Fernabsatz allein nicht (Prüfung bei Übergabe nötig).
4. **Zahlung vor Ort / Reservierung:** Wirksamkeit der Verfallsklausel (Reservierung bis Ladenschluss des Abholtags, danach automatisch frei) und
   Hinweis, dass kein Anspruch auf Ware nach Verfall besteht.
5. **Lieferpreis „voraussichtlich“:** Preisangabenverordnung — der endgültige Gesamtpreis steht vor Abgabe der Bestellung fest (Server rechnet bei der
   Bestellung neu, Stripe zeigt den endgültigen Betrag); Formulierung „voraussichtlich“ nur bis zur Bestellung zulässig.
6. **Verpackungsgesetz** (Registrierung/Lizenz der Versandverpackung, Pfand/Glas): prüfen.
7. **Datenschutz:** Lieferadresse wird zur Preisberechnung an OpenRouteService übermittelt (Hinweis in `src/content/legal/datenschutz.json`; Hauptfassung dort,
   byte-gleich mit ristorantestoria.de!). Grußkartentext = Bestelldaten.

---

## Teil C2 – Online-Shop: Geschenkkörbe (Entwurf)

*Einzufügen als eigener Teil nach Teil C (§§ 18–24); Paragraphen mit Suffix, damit die bestehende Nummerierung stabil bleibt.*

### § 24a Geltung
(1) Dieser Teil gilt für Bestellungen von STORIA-Geschenkkörben im Online-Shop (Speranza GmbH, Karlstraße 47a, 80333 München). Ergänzend gelten Teil A und F.
(2) Teil C (§§ 18–24) gilt für Geschenkkörbe nicht, soweit dieser Teil Abweichendes regelt; insbesondere gelten die Regeln zu Mindestbestellwert, Hin- und Rückfahrt,
Geschirr und Leihgeräten nicht.

### § 24b Angebot, Vorrat, Vertragsschluss
(1) Angebot und Abbildungen sind Darstellungen; Weinsorte und Inhalt sind je Korb im Shop beschrieben. Der Verkauf erfolgt nur solange der Vorrat reicht.
(2) Mit Klick auf „zahlungspflichtig bestellen“ (bei Zahlung vor Ort: „verbindlich reservieren“) gibt der Kunde ein verbindliches Angebot ab. Der Vertrag kommt zustande,
wenn STORIA die Bestellung per E-Mail bestätigt (Bestellbestätigung in Textform) bzw. — bei Zahlung online — mit der bestätigten Zahlung und Bestätigungsmail.
(3) Ist ein Korb oder die gewählte Weinsorte nicht mehr vorrätig, kommt kein Vertrag zustande; bereits geleistete Zahlungen werden unverzüglich erstattet.

### § 24c Preise, Lieferpreis
(1) Alle Preise sind Endpreise in Euro inklusive gesetzlicher Umsatzsteuer.
(2) Lieferung erfolgt gegen eine Liefergebühr nach Entfernung (einfache Straßenstrecke ab Karlstraße 47a): erste 7 km je 2,70 €, jeder weitere Kilometer 2,50 €,
mindestens 5,90 €, exakt auf den Cent berechnet (kein Aufrunden). Vor Abgabe der Bestellung wird der voraussichtliche Preis angezeigt; der verbindliche Gesamtpreis wird bei der Bestellung
berechnet und vor Zahlung angezeigt.
(3) Abholung in der Karlstraße 47a ist kostenfrei.

### § 24d Zahlung, Reservierung
(1) Zahlung online über Stripe. Bei Abholung kann alternativ **vor Ort** bezahlt werden.
(2) Bei Zahlung vor Ort reserviert STORIA den Korb bis Ladenschluss des gewählten Abholtags. Wird der Korb bis dahin nicht abgeholt, erlischt die Reservierung, der Korb
geht automatisch in den Verkauf zurück, und der Kunde wird per E-Mail informiert. Ein Anspruch auf Lieferung nach Verfall besteht nicht.

### § 24e Übergabe, Altersgrenze
(1) **Abholung:** am gewählten Tag zu den im Shop angebotenen Zeiten; bei vorrätigem Korb auch am selben Tag nach Ablauf der Packzeit. **Lieferung:** frühestens am Folgetag, im
gewählten Zeitfenster; ein Anspruch auf eine bestimmte Uhrzeit besteht nicht. Sperrtage (Betriebsferien, Feiertage) sind im Shop nicht wählbar.
(2) Wein und Crémant werden nur an Personen ab 16 Jahren abgegeben. Die Übergabe erfolgt nur an Personen ab 16 Jahren; STORIA darf einen Altersnachweis verlangen. Kann
die Übergabe wegen fehlender Altersberechtigung nicht erfolgen, gilt die Lieferung als gescheitert; § 24g Abs. 3 gilt entsprechend.
(3) Wird bei Lieferung niemand angetroffen, versucht STORIA die Übergabe nach Absprache erneut; Mehrkosten trägt der Kunde, wenn er die Nichtübergabe zu vertreten hat.

### § 24f Widerruf (Entwurf nach Entscheidung 20.11.2026 — Anwaltsprüfung erforderlich; maßgeblich die AGB 2026-11, § 41)
(1) Es gilt das gesetzliche Widerrufsrecht: Der Kunde kann den Vertrag innerhalb von 14 Tagen ab Erhalt der Ware (Abholung bzw. Lieferung) ohne Angabe von Gründen widerrufen.
(2) Die unmittelbaren Kosten der Rücksendung trägt der Kunde.
(3) Das Widerrufsrecht besteht nicht bei versiegelten Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde (§ 312g Abs. 2 Nr. 3 BGB), also nicht für geöffnete versiegelte Lebensmittel.
(4) Einzelheiten, Muster-Widerrufsformular und Rückzahlung: Widerrufsbelehrung.

### § 24g Stornierung, Mängel
(1) Stornierung durch den Kunden vor Zahlung/Abholung ist kostenfrei (siehe § 24f); für bereits gezahlte Bestellungen erstattet STORIA über Stripe.
(2) Bei Mängeln gelten die gesetzlichen Rechte; Beanstandungen bitte unverzüglich an info@events-storia.de.
(3) Gelingt die Übergabe aus Gründen, die der Kunde zu vertreten hat, nicht, kann STORIA Ersatz der Lieferkosten verlangen.

### § 24h Lebensmittelinformationen
Pflichtangaben (Verkehrsbezeichnung, Zutaten mit hervorgehobenen Allergenen, Nettofüllmenge, Alkoholgehalt, Lebensmittelunternehmer, Herkunft wo vorgeschrieben) stehen im Shop
je Bestandteil **vor** Abgabe der Bestellung. Mindesthaltbarkeit/Lagerhinweise werden bei Lieferung/Abholung mitgeteilt. (Daten: Etikettenfotos, Abtippen + Gegenlesen — offen.)

---

## Anpassung bestehende Texte (Entwurf)
- **§ 8 Widerrufsrecht (Teil A):** Ausschluss für Speisen/Getränke auf Catering/Pizza beschränken; Geschenkkörbe ausdrücklich auf § 24f verweisen. AGB-Version erhöhen
  (`GIFT_AGB_VERSION` in `giftLegal.ts`; die Pflicht-Checkbox speichert die Version je Bestellung in `gift_orders.agb_version`).
- **Widerrufsbelehrung (`src/pages/Widerrufsbelehrung.tsx`, DE/EN):** eigener Abschnitt „Geschenkkörbe“ gemäß Anwaltsfassung; ggf. Muster-Widerrufsformular.
- **Datenschutz (`src/content/legal/datenschutz.json`, byte-gleich mit ristorantestoria.de):** Übermittlung der Lieferadresse an OpenRouteService (Preisberechnung), Grußkartentext.
- **Lebensmittelhinweise:** Verweis auf die Pflichtangaben im Shop.
- **Kurztexte im Shop/in Mails:** `GIFT_TEXTS` in `supabase/functions/_shared/giftLegal.ts` (Widerruf, Altersgrenze, Vor-Ort-Hinweis, Lieferpreis „voraussichtlich“).
