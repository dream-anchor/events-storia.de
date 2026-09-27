import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";
import { LocalizedLink } from "@/components/LocalizedLink";

const Widerrufsbelehrung = () => {
  return (
    <>
      <SEO 
        title="Widerrufsbelehrung"
        description="Widerrufsbelehrung der Speranza GmbH (STORIA München): 14-tägiges Widerrufsrecht, Ausschluss bei Speisenlieferungen und Veranstaltungen zu einem festen Termin."
        noIndex={true}
      />
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
                E-Mail: info@events-storia.de
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
                  <strong>Veranstaltungen und Speisenlieferungen zu einem festen Termin:</strong> Bei
                  Verträgen über die Lieferung von Speisen und Getränken sowie über Veranstaltungs- und
                  Catering-Leistungen, die zu einem bestimmten Termin oder in einem bestimmten Zeitraum
                  erbracht werden, besteht gemäß § 312g Abs. 2 Nr. 9 BGB kein Widerrufsrecht. Dies gilt
                  für Veranstaltungen im Restaurant, individuelle Catering-Angebote, Eventpakete sowie
                  Catering- und Pizza-Bestellungen im Online-Shop.
                </li>
                <li>
                  <strong>Schnell verderbliche Lebensmittel:</strong> Bei der Lieferung von Waren, die
                  schnell verderben können oder deren Verfallsdatum schnell überschritten würde, besteht
                  zusätzlich gemäß § 312g Abs. 2 Nr. 2 BGB kein Widerrufsrecht.
                </li>
              </ul>
              <p className="mt-4">
                Für Absagen und Stornierungen gelten stattdessen die Regelungen unserer{" "}
                <LocalizedLink to="legal.terms" className="text-primary hover:underline">AGB</LocalizedLink>{" "}
                (§ 13 Veranstaltungen, § 23 Online-Shop, § 27 Reservierungen).
              </p>
              <p className="mt-4">
                <strong>Gutscheine:</strong> Beim Kauf von Gutscheinen steht Verbrauchern das oben
                beschriebene 14-tägige Widerrufsrecht zu. Es erlischt nicht bereits mit der Erstellung
                oder dem Versand des Gutscheins.
              </p>
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
                  E-Mail: info@events-storia.de
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
                Stand: 28. September 2026
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

export default Widerrufsbelehrung;
