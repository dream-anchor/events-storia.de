import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";

const AGBRestaurant = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Allgemeine Geschäftsbedingungen
          </h1>
          <p className="text-center text-muted-foreground mb-12">Restaurant & Reservierungen</p>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                1. Geltungsbereich
              </h2>
              <p>
                Diese Allgemeinen Geschäftsbedingungen gelten für alle Reservierungen, gastronomischen 
                Leistungen und Veranstaltungen der Speranza GmbH, Karlstraße 47a, 80333 München 
                (nachfolgend „STORIA" oder „wir").
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                2. Reservierungen
              </h2>
              <p>
                Eine Reservierung ist ein verbindliches Angebot zum Abschluss eines Bewirtungsvertrags. 
                Mit Bestätigung der Reservierung durch uns kommt ein verbindlicher Vertrag zustande.
              </p>
              <p>
                Reservierungen können online über OpenTable, telefonisch oder per E-Mail vorgenommen werden. 
                Bitte beachten Sie, dass wir Tische nur für eine begrenzte Zeit freihalten können.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                3. Stornierung & No-Show
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Stornierungen bis 24 Stunden vor dem reservierten Termin sind kostenfrei möglich.
                </li>
                <li>
                  Bei Nichterscheinen („No-Show") ohne vorherige Absage behalten wir uns vor, 
                  eine Ausfallpauschale von <strong>25 € pro Person</strong> zu erheben.
                </li>
                <li>
                  Verspätungen von mehr als 15 Minuten können zum Verfall der Reservierung führen, 
                  sofern keine telefonische Mitteilung erfolgt.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                4. Gruppen ab 8 Personen
              </h2>
              <p>
                Für Gruppenreservierungen ab 8 Personen gelten besondere Bedingungen:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Wir behalten uns vor, für Gruppen eine verbindliche Menüauswahl vorab zu vereinbaren.</li>
                <li>Eine Mindestabnahme (z.B. bestimmte Anzahl an Menüs) kann vereinbart werden.</li>
                <li>Bei Gruppen ab 15 Personen kann eine Anzahlung von bis zu 50% verlangt werden.</li>
                <li>Die Stornierungsfrist verlängert sich auf 48 Stunden vor dem Termin.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                5. Haftung
              </h2>
              <p>
                Wir haften nur für Schäden, die auf Vorsatz oder grober Fahrlässigkeit unsererseits beruhen. 
                Dies gilt nicht für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.
              </p>
              <p>
                Für mitgebrachte Gegenstände übernehmen wir keine Haftung, es sei denn, sie wurden 
                ausdrücklich in unsere Obhut gegeben.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                6. Hausrecht
              </h2>
              <p>
                Wir üben das Hausrecht aus. Gäste, die gegen die Hausordnung verstoßen, andere Gäste 
                belästigen oder sich unangemessen verhalten, können des Lokals verwiesen werden.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                7. Gutscheine
              </h2>
              <p>
                Für den Kauf und die Einlösung von Gutscheinen gelten zusätzliche AGB. 
                Bitte beachten Sie unsere{" "}
                <a href="/agb-gutscheine" className="text-primary hover:underline">
                  AGB für Gutscheine
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                8. Salvatorische Klausel
              </h2>
              <p>
                Sollte eine Bestimmung dieser AGB unwirksam sein oder werden, so bleibt die Wirksamkeit 
                der übrigen Bestimmungen davon unberührt. An die Stelle der unwirksamen Bestimmung tritt 
                eine wirksame Regelung, die dem wirtschaftlichen Zweck der unwirksamen Bestimmung am 
                nächsten kommt.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                9. Anwendbares Recht
              </h2>
              <p>
                Es gilt deutsches Recht. Gerichtsstand ist, soweit gesetzlich zulässig, München.
              </p>
            </section>

            <section className="mt-12 pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Stand: Dezember 2024
              </p>
              <p className="mt-4">
                Speranza GmbH<br />
                Karlstraße 47a<br />
                80333 München
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
      <FloatingActions />
    </div>
  );
};

export default AGBRestaurant;
