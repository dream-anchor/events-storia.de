import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";

const AGBVeranstaltungen = () => {
  return (
    <>
      <SEO
        title="AGB für Veranstaltungen"
        description="Allgemeine Geschäftsbedingungen für Veranstaltungen der Dream & Anchor Handelsgesellschaft mbH (STORIA Events München): Buchung, Anzahlung, Stornierung."
        noIndex={true}
      />
      <div className="min-h-screen bg-background">
        <Header />

        <main className="pt-32 pb-20 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-4 text-center">
              Allgemeine Geschäftsbedingungen für Veranstaltungen
            </h1>
            <p className="text-center text-sm text-muted-foreground mb-12">
              Stand: April 2026 — Dream & Anchor Handelsgesellschaft mbH
            </p>

            <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">

              {/* § 1 Geltungsbereich */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 1 Geltungsbereich
                </h2>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    Diese Allgemeinen Geschäftsbedingungen für Veranstaltungen (nachfolgend „AGBV") gelten für
                    sämtliche Verträge über die Durchführung von Veranstaltungen einschließlich Catering-Dienstleistungen,
                    die mietweise Überlassung von Veranstaltungsräumen sowie alle damit zusammenhängenden Leistungen des
                    Ristorante STORIA, Karlstraße 47a, 80333 München, betrieben durch die Dream &amp; Anchor
                    Handelsgesellschaft mbH (nachfolgend „STORIA").
                  </li>
                  <li>
                    Abweichende Geschäftsbedingungen des Kunden finden nur Anwendung, wenn dies ausdrücklich
                    in Textform vereinbart wurde.
                  </li>
                  <li>
                    Es gilt die zum Zeitpunkt des Vertragsschlusses gültige Fassung dieser AGBV.
                  </li>
                </ol>
              </section>

              {/* § 2 Vertragsschluss */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 2 Vertragsschluss
                </h2>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    Angebote von STORIA sind freibleibend und unverbindlich.
                  </li>
                  <li>
                    Ein verbindlicher Vertrag kommt zustande durch:
                    <ol className="list-[lower-alpha] pl-6 mt-2 space-y-1">
                      <li>Annahme des Angebots durch den Kunden in Textform (E-Mail genügt), oder</li>
                      <li>Leistung der vereinbarten Anzahlung.</li>
                    </ol>
                  </li>
                  <li>
                    Handelt der Besteller im Namen eines Dritten, so haftet der Besteller gemeinsam mit dem
                    Dritten gesamtschuldnerisch für alle Verpflichtungen aus dem Vertrag, sofern STORIA keine
                    entsprechende Erklärung des Dritten vorliegt.
                  </li>
                </ol>
              </section>

              {/* § 3 Preise und Zahlung */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 3 Preise und Zahlung
                </h2>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    Alle Preise verstehen sich in Euro inklusive der gesetzlichen Umsatzsteuer von derzeit 19 %.
                  </li>
                  <li>
                    STORIA ist berechtigt, eine Anzahlung in frei vereinbarter Höhe zu verlangen. Die Höhe der
                    Anzahlung und das Fälligkeitsdatum werden im jeweiligen Angebot oder der Auftragsbestätigung
                    individuell festgelegt.
                  </li>
                  <li>
                    Der fristgerechte Eingang der Anzahlung ist Voraussetzung für die verbindliche Reservierung
                    des Veranstaltungstermins. Geht die Anzahlung nicht innerhalb von 7 Tagen nach Rechnungs-
                    stellung ein, behält sich STORIA vor, den Termin anderweitig zu vergeben.
                  </li>
                  <li>
                    Eine Vorauszahlung auf den Restbetrag kann vereinbart werden. Die Fälligkeit wird im
                    Angebot oder der Auftragsbestätigung individuell festgelegt.
                  </li>
                  <li>
                    Sofern nicht anders vereinbart, ist der nach Anzahlung und Vorauszahlung verbleibende
                    Restbetrag am Veranstaltungstag oder spätestens 7 Tage nach Erhalt der Schlussrechnung
                    ohne Abzug fällig.
                  </li>
                  <li>
                    Zahlungen können per Kreditkarte, SEPA-Lastschrift, Kauf auf Rechnung über Billie
                    (für Geschäftskunden) oder Überweisung erfolgen. Die Zahlungsabwicklung erfolgt über
                    den Zahlungsdienstleister Stripe Payments Europe Ltd.
                  </li>
                  <li>
                    Bei Zahlungsverzug gelten die gesetzlichen Verzugsregelungen. Verzugszinsen betragen
                    für Verbraucher 5 Prozentpunkte, für Unternehmer 9 Prozentpunkte über dem jeweiligen
                    Basiszinssatz (§§ 288, 247 BGB).
                  </li>
                  <li>
                    Der Kunde kann nur mit unbestrittenen oder rechtskräftig festgestellten Forderungen
                    aufrechnen.
                  </li>
                </ol>
              </section>

              {/* § 4 Teilnehmerzahl */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 4 Teilnehmerzahl
                </h2>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    Die verbindliche Teilnehmerzahl ist spätestens 48 Stunden vor Veranstaltungsbeginn in
                    Textform mitzuteilen. Ohne fristgerechte Mitteilung gilt die bei Buchung angegebene
                    Personenzahl als verbindlich.
                  </li>
                  <li>
                    Erhöht sich die tatsächliche Teilnehmerzahl gegenüber der vereinbarten Zahl, wird nach
                    tatsächlicher Teilnehmerzahl abgerechnet.
                  </li>
                  <li>
                    Verringert sich die Teilnehmerzahl, wird auf Basis der zuletzt verbindlich gemeldeten
                    Zahl abgerechnet, sofern die Verringerung nicht mindestens 48 Stunden vor der
                    Veranstaltung mitgeteilt wurde.
                  </li>
                </ol>
              </section>

              {/* § 5 Rücktritt des Kunden */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 5 Rücktritt des Kunden (Stornierung)
                </h2>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    Der Kunde kann jederzeit vom Vertrag zurücktreten. Der Rücktritt bedarf der Textform
                    (E-Mail genügt).
                  </li>
                  <li>
                    Im Falle eines Rücktritts ist STORIA berechtigt, folgenden pauschalierten
                    Schadensersatz zu verlangen:
                    <ul className="list-none pl-4 mt-2 space-y-1 border-l-2 border-border">
                      <li className="pl-3">Bis 30 Tage vor der Veranstaltung: <strong>kostenfrei</strong></li>
                      <li className="pl-3">14 bis 30 Tage vorher: <strong>25 %</strong> des vereinbarten Gesamtbetrags</li>
                      <li className="pl-3">7 bis 14 Tage vorher: <strong>50 %</strong> des vereinbarten Gesamtbetrags</li>
                      <li className="pl-3">2 bis 7 Tage vorher: <strong>80 %</strong> des vereinbarten Gesamtbetrags</li>
                      <li className="pl-3">Weniger als 48 Stunden vorher / Nichterscheinen: <strong>100 %</strong> abzüglich ersparter Aufwendungen</li>
                    </ul>
                  </li>
                  <li>
                    Dem Kunden steht der Nachweis frei, dass STORIA kein oder ein wesentlich geringerer
                    Schaden entstanden ist (§ 309 Nr. 5 lit. b BGB).
                  </li>
                  <li>
                    STORIA steht der Nachweis frei, dass ein höherer Schaden entstanden ist.
                  </li>
                  <li>
                    Bereits geleistete Anzahlungen werden mit dem pauschalierten Schadensersatz verrechnet.
                    Übersteigt die Anzahlung den Stornobetrag, wird die Differenz erstattet.
                  </li>
                </ol>
              </section>

              {/* § 6 Rücktritt STORIA */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 6 Rücktritt von STORIA
                </h2>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    STORIA ist berechtigt, aus sachlich gerechtfertigtem Grund vom Vertrag zurückzutreten,
                    insbesondere wenn:
                    <ol className="list-[lower-alpha] pl-6 mt-2 space-y-1">
                      <li>höhere Gewalt oder andere von STORIA nicht zu vertretende Umstände die Durchführung unmöglich machen,</li>
                      <li>die Veranstaltung unter irreführenden oder falschen Angaben gebucht wurde,</li>
                      <li>STORIA begründeten Anlass zu der Annahme hat, dass die Veranstaltung den reibungslosen Geschäftsbetrieb oder das Ansehen von STORIA gefährden kann,</li>
                      <li>der Kunde mit einer fälligen Anzahlung oder Vorauszahlung in Verzug ist.</li>
                    </ol>
                  </li>
                  <li>
                    Im Falle eines berechtigten Rücktritts durch STORIA bestehen keine Schadensersatzansprüche
                    des Kunden.
                  </li>
                </ol>
              </section>

              {/* § 7 Widerrufsrecht */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 7 Widerrufsrecht
                </h2>
                <p>
                  Da es sich um einen Vertrag zur Erbringung von Dienstleistungen im Bereich der Lieferung
                  von Speisen und Getränken zu einem spezifischen Termin handelt, besteht gemäß{" "}
                  <strong>§ 312g Abs. 2 Nr. 9 BGB kein Widerrufsrecht</strong>. Stattdessen gelten die
                  Stornobedingungen gemäß § 5 dieser AGBV.
                </p>
              </section>

              {/* § 8 Haftung */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 8 Haftung
                </h2>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    STORIA haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder
                    der Gesundheit sowie für Schäden, die auf vorsätzlichem oder grob fahrlässigem Verhalten
                    beruhen.
                  </li>
                  <li>
                    Für sonstige Schäden haftet STORIA nur bei Verletzung wesentlicher Vertragspflichten
                    (Kardinalpflichten). In diesem Fall ist die Haftung auf den vertragstypischen,
                    vorhersehbaren Schaden begrenzt.
                  </li>
                  <li>
                    Für eingebrachte Gegenstände des Kunden und seiner Gäste übernimmt STORIA keine
                    Haftung, es sei denn, diese wurden ausdrücklich in Obhut genommen.
                  </li>
                </ol>
              </section>

              {/* § 9 Datenschutz */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 9 Datenschutz
                </h2>
                <p>
                  Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer{" "}
                  <a href="/datenschutz" className="text-primary hover:underline">
                    Datenschutzerklärung
                  </a>. Zahlungsdaten werden über Stripe Payments Europe Ltd. verarbeitet.
                  Für Kauf auf Rechnung (Geschäftskunden) wird Billie GmbH als Zahlungsdienstleister
                  eingesetzt und führt eine Bonitätsprüfung durch.
                </p>
              </section>

              {/* § 10 Schlussbestimmungen */}
              <section>
                <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                  § 10 Schlussbestimmungen
                </h2>
                <ol className="list-decimal pl-6 space-y-2">
                  <li>
                    Änderungen und Ergänzungen des Vertrages bedürfen der Textform.
                  </li>
                  <li>
                    Sollte eine Bestimmung dieser AGBV unwirksam sein oder werden, so berührt dies die
                    Wirksamkeit der übrigen Bestimmungen nicht.
                  </li>
                  <li>Es gilt das Recht der Bundesrepublik Deutschland.</li>
                  <li>
                    Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-
                    rechtliches Sondervermögen, ist Gerichtsstand München.
                  </li>
                </ol>
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

export default AGBVeranstaltungen;
