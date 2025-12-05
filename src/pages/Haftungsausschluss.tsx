import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";

const Haftungsausschluss = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Haftungsausschluss
          </h1>
          <p className="text-center text-muted-foreground mb-12">Disclaimer</p>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                1. Haftung für Inhalte
              </h2>
              <p>
                Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen 
                Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind 
                wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte 
                fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine 
                rechtswidrige Tätigkeit hinweisen.
              </p>
              <p>
                Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach 
                den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung 
                ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung 
                möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese 
                Inhalte umgehend entfernen.
              </p>
              <p>
                Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die 
                Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch 
                keine Gewähr übernehmen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                2. Haftung für externe Links
              </h2>
              <p>
                Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte 
                wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch 
                keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der 
                jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
              </p>
              <p>
                Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche 
                Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der 
                Verlinkung nicht erkennbar.
              </p>
              <p>
                Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne 
                konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden 
                von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                3. Speisekarte und Preise
              </h2>
              <p>
                Die auf unserer Website dargestellte Speisekarte und die angegebenen Preise 
                dienen ausschließlich der allgemeinen Information und stellen kein verbindliches 
                Angebot dar.
              </p>
              <p className="p-4 bg-secondary/30 rounded-lg border border-border mt-4">
                <strong>Wichtiger Hinweis:</strong> Maßgeblich für die Bestellung und Abrechnung 
                sind ausschließlich die im Restaurant ausliegenden aktuellen Speise- und 
                Getränkekarten. Änderungen der Speisekarte und der Preise sind jederzeit möglich 
                und vorbehalten.
              </p>
              <p>
                Saisonale Gerichte und Tagesempfehlungen können von der Online-Darstellung abweichen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                4. Urheberrecht
              </h2>
              <p>
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten 
                unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, 
                Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes 
                bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. 
                Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen 
                Gebrauch gestattet.
              </p>
              <p>
                Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden 
                die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche 
                gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam 
                werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von 
                Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                5. Bildrechte
              </h2>
              <p>
                Alle auf dieser Website verwendeten Bilder und Grafiken sind urheberrechtlich 
                geschützt. Die Bildrechte liegen, sofern nicht anders angegeben, bei der 
                Speranza GmbH oder wurden von Dritten lizenziert.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                6. Markenrechte
              </h2>
              <p>
                „STORIA" und das STORIA-Logo sind eingetragene Marken der Speranza GmbH. 
                Die Verwendung dieser Marken ohne ausdrückliche Genehmigung ist nicht gestattet.
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

export default Haftungsausschluss;
