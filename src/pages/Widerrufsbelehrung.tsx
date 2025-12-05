import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";

const Widerrufsbelehrung = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Widerrufsbelehrung
          </h1>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Widerrufsrecht
              </h2>
              <p>
                Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
              </p>
              <p>
                Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
              </p>
              <p>
                Um Ihr Widerrufsrecht auszuüben, müssen Sie uns:
              </p>
              <p className="pl-4 border-l-2 border-primary">
                Speranza GmbH<br />
                Karlstraße 47a<br />
                80333 München<br />
                Telefon: +49 89 51519696<br />
                E-Mail: info@ristorantestoria.de
              </p>
              <p>
                mittels einer eindeutigen Erklärung (z.B. ein mit der Post versandter Brief oder E-Mail) 
                über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das 
                beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
              </p>
              <p>
                Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die 
                Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Ausschluss des Widerrufsrechts
              </h2>
              <p>
                Das Widerrufsrecht besteht nicht bei folgenden Verträgen:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Gutscheine, die bereits ganz oder teilweise eingelöst wurden
                </li>
                <li>
                  Personalisierte Gutscheine, die auf eine bestimmte Person ausgestellt und 
                  bereits erstellt wurden
                </li>
                <li>
                  Reservierungen und gastronomische Dienstleistungen, die bereits erbracht wurden
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Folgen des Widerrufs
              </h2>
              <p>
                Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von 
                Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen 
                Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von 
                uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und 
                spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung 
                über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.
              </p>
              <p>
                Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der 
                ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde 
                ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser 
                Rückzahlung Entgelte berechnet.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                Muster-Widerrufsformular
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus 
                und senden Sie es zurück.)
              </p>
              <div className="bg-secondary/30 p-6 rounded-lg border border-border">
                <p>An:</p>
                <p>
                  Speranza GmbH<br />
                  Karlstraße 47a<br />
                  80333 München<br />
                  E-Mail: info@ristorantestoria.de
                </p>
                <p className="mt-4">
                  Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag 
                  über den Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*)
                </p>
                <p className="mt-2">_______________________________________</p>
                <p className="mt-4">Bestellt am (*) / erhalten am (*): _______________________________________</p>
                <p className="mt-2">Name des/der Verbraucher(s): _______________________________________</p>
                <p className="mt-2">Anschrift des/der Verbraucher(s): _______________________________________</p>
                <p className="mt-4">_______________________________________</p>
                <p>Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)</p>
                <p className="mt-4">Datum: _______________________________________</p>
                <p className="mt-4 text-sm text-muted-foreground">(*) Unzutreffendes streichen</p>
              </div>
            </section>

            <section className="mt-12 pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Stand: Dezember 2024
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

export default Widerrufsbelehrung;
