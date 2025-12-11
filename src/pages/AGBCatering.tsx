import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";

const AGBCatering = () => {
  return (
    <>
      <SEO 
        title="AGB Catering & Lieferservice"
        description="AGB für Catering & Lieferservice der Speranza GmbH München: Bestellungen, Lieferung, Stornierung und Zahlungsbedingungen."
        noIndex={true}
      />
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Allgemeine Geschäftsbedingungen für Catering & Lieferservice
          </h1>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            
            {/* §1 Geltungsbereich */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 1 Geltungsbereich
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge über Catering-Dienstleistungen, 
                  Speiselieferungen und damit verbundene Serviceleistungen zwischen der Speranza GmbH (nachfolgend „Anbieter") und 
                  dem Kunden, die über den Online-Shop auf storia-restaurant.de oder telefonisch abgeschlossen werden.
                </li>
                <li>
                  Es gilt die zum Zeitpunkt der Bestellung gültige Fassung dieser AGB.
                </li>
                <li>
                  Abweichende Bedingungen des Kunden werden nicht Vertragsbestandteil, es sei denn, der Anbieter stimmt 
                  ihrer Geltung ausdrücklich schriftlich zu.
                </li>
              </ol>
            </section>

            {/* §2 Vertragsschluss */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 2 Vertragsschluss
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Die Darstellung der Produkte und Dienstleistungen im Online-Shop stellt kein rechtlich bindendes Angebot, 
                  sondern eine Aufforderung zur Bestellung dar.
                </li>
                <li>
                  Mit dem Absenden der Bestellung gibt der Kunde ein verbindliches Angebot zum Abschluss eines Kaufvertrages ab.
                </li>
                <li>
                  Der Vertrag kommt zustande, wenn der Anbieter die Bestellung durch Zusendung einer Auftragsbestätigung 
                  per E-Mail annimmt oder die bestellten Waren liefert.
                </li>
                <li>
                  Die automatische Eingangsbestätigung der Bestellung stellt noch keine Annahme des Angebots dar.
                </li>
              </ol>
            </section>

            {/* §3 Preise und Zahlungsbedingungen */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 3 Preise und Zahlungsbedingungen
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Alle angegebenen Preise sind Endpreise in Euro und verstehen sich inklusive der gesetzlichen Mehrwertsteuer 
                  (7% auf Speisen, 19% auf Lieferdienstleistungen).
                </li>
                <li>
                  Lieferkosten werden gesondert ausgewiesen und dem Kunden vor Abschluss der Bestellung transparent angezeigt.
                </li>
                <li>
                  Folgende Zahlungsarten stehen zur Verfügung:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Kreditkarte (Visa, Mastercard) über Stripe</li>
                    <li>Zahlung auf Rechnung (nur für Geschäftskunden nach Prüfung)</li>
                  </ul>
                </li>
                <li>
                  Bei Zahlung per Rechnung ist der Rechnungsbetrag innerhalb von 14 Tagen nach Rechnungsdatum ohne Abzug zu zahlen.
                </li>
              </ol>
            </section>

            {/* §4 Lieferung und Mindestbestellwert */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 4 Lieferung und Mindestbestellwert
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Der Anbieter liefert im Raum München und Umgebung. Das genaue Liefergebiet und die Lieferkosten 
                  werden im Bestellprozess angezeigt.
                </li>
                <li>
                  Lieferkostenstaffelung:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Bis 1 km Entfernung: kostenlos (Mindestbestellwert: 50 €)</li>
                    <li>1–25 km (Münchner Stadtgebiet): 25 € netto pro Fahrt (Mindestbestellwert: 150 €)</li>
                    <li>Über 25 km: 1,20 € netto pro Kilometer (Mindestbestellwert: 200 €)</li>
                  </ul>
                </li>
                <li>
                  Bei Catering-Bestellungen (Platten, Buffet, Aufläufe) wird aufgrund der Geschirrabholung der 
                  doppelte Kilometersatz berechnet. Bei Pizza-Bestellungen (Einwegverpackung) nur einfacher Satz.
                </li>
                <li>
                  Die Lieferung erfolgt zum vereinbarten Termin. Eine Wartezeit von mehr als 15 Minuten vor Ort 
                  wird mit 35 € netto pro angefangene Stunde berechnet.
                </li>
                <li>
                  Der Kunde ist verpflichtet, zum vereinbarten Lieferzeitpunkt anwesend zu sein und die Annahme 
                  der Lieferung zu gewährleisten. Zusätzliche Anfahrten aufgrund Nichtanwesenheit werden berechnet.
                </li>
              </ol>
            </section>

            {/* §5 Selbstabholung */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 5 Selbstabholung
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Die Selbstabholung ist nach vorheriger Vereinbarung möglich am Standort:<br />
                  Karlstraße 47a, 80333 München
                </li>
                <li>
                  Bei Selbstabholung entfallen die Lieferkosten sowie der Mindestbestellwert.
                </li>
              </ol>
            </section>

            {/* §6 Stornierung und Terminänderung */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 6 Stornierung und Terminänderung
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  <strong>Catering-Bestellungen (Platten, Buffet, Aufläufe):</strong>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Stornierung bis 48 Stunden vor dem vereinbarten Liefertermin: kostenfrei</li>
                    <li>Stornierung zwischen 48 und 24 Stunden: 50% des Warenwertes</li>
                    <li>Stornierung unter 24 Stunden: 100% des Warenwertes</li>
                  </ul>
                </li>
                <li>
                  <strong>Pizza-Bestellungen:</strong>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>Stornierung bis 2 Stunden vor dem vereinbarten Liefertermin: kostenfrei</li>
                    <li>Danach: 100% des Warenwertes</li>
                  </ul>
                </li>
                <li>
                  Terminänderungen sind nach Absprache und Verfügbarkeit möglich. 
                  Bei kurzfristigen Änderungen unter 24 Stunden kann ein Aufpreis entstehen.
                </li>
              </ol>
            </section>

            {/* §7 Geschirr und Reinigung */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 7 Geschirr und Reinigung
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Die Reinigung des gelieferten Geschirrs ist im Preis aller Platten inklusive.
                </li>
                <li>
                  Das Geschirr wird am Folgetag oder zu einem vereinbarten Termin abgeholt. 
                  Eine Rückgabe des Geschirrs in nicht gereinigtem Zustand ist zulässig.
                </li>
                <li>
                  Für beschädigtes oder nicht zurückgegebenes Geschirr kann der Anbieter Ersatz verlangen.
                </li>
                <li>
                  Besteck, Stoffservietten und weiteres Zubehör können gegen Aufpreis hinzugebucht werden.
                </li>
              </ol>
            </section>

            {/* §8 Gewährleistung und Reklamation */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 8 Gewährleistung und Reklamation
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Der Kunde ist verpflichtet, die gelieferten Speisen und Waren bei Übergabe sofort zu prüfen 
                  und offensichtliche Mängel unverzüglich anzuzeigen.
                </li>
                <li>
                  Reklamationen bezüglich der Qualität der Speisen müssen am Tag der Lieferung erfolgen.
                </li>
                <li>
                  Bei berechtigten Reklamationen wird der Anbieter nach seiner Wahl Ersatz liefern oder 
                  den Kaufpreis anteilig erstatten.
                </li>
              </ol>
            </section>

            {/* §9 Haftung */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 9 Haftung
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Der Anbieter haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden 
                  aus der Verletzung des Lebens, des Körpers oder der Gesundheit.
                </li>
                <li>
                  Bei leichter Fahrlässigkeit haftet der Anbieter nur bei Verletzung einer wesentlichen 
                  Vertragspflicht. Die Haftung ist in diesem Fall auf den typischen, vorhersehbaren Schaden begrenzt.
                </li>
                <li>
                  Der Anbieter haftet nicht für Schäden, die durch unsachgemäße Lagerung oder Behandlung 
                  der gelieferten Speisen durch den Kunden entstehen.
                </li>
              </ol>
            </section>

            {/* §10 Widerrufsrecht */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 10 Widerrufsrecht
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Bei der Lieferung von Lebensmitteln, die schnell verderben können oder deren Verfallsdatum 
                  schnell überschritten würde, besteht gemäß § 312g Abs. 2 Nr. 2 BGB <strong>kein Widerrufsrecht</strong>.
                </li>
                <li>
                  Dies gilt für alle Catering-Bestellungen und Speiselieferungen.
                </li>
                <li>
                  Weitere Informationen finden Sie in unserer{' '}
                  <Link to="/widerrufsbelehrung" className="text-primary underline hover:text-primary/80">
                    Widerrufsbelehrung
                  </Link>.
                </li>
              </ol>
            </section>

            {/* §11 Datenschutz */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 11 Datenschutz
              </h2>
              <p>
                Informationen zur Erhebung und Verarbeitung personenbezogener Daten finden Sie in unserer{' '}
                <Link to="/datenschutz" className="text-primary underline hover:text-primary/80">
                  Datenschutzerklärung
                </Link>.
              </p>
            </section>

            {/* §12 Schlussbestimmungen */}
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                § 12 Schlussbestimmungen
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li>
                  Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
                </li>
                <li>
                  Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches 
                  Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Vertrag 
                  der Geschäftssitz des Anbieters (München).
                </li>
                <li>
                  Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, berührt dies die 
                  Wirksamkeit der übrigen Bestimmungen nicht.
                </li>
              </ol>
            </section>

            {/* Anbieter-Info */}
            <section className="mt-12 pt-8 border-t border-border">
              <h3 className="font-serif font-medium text-foreground mb-3">Anbieter</h3>
              <p>
                Speranza GmbH<br />
                Karlstraße 47a<br />
                80333 München<br />
                E-Mail: info@events-storia.de<br />
                Telefon: +49 89 51519696
              </p>
              <p className="text-sm text-muted-foreground mt-6">
                Stand: Dezember 2024
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingActions />
    </div>
    </>
  );
};

export default AGBCatering;