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
        description="Widerrufsbelehrung der Speranza GmbH (STORIA München): 14-tägiges Widerrufsrecht, Ausschluss bei Speisenlieferungen und Veranstaltungen zu einem festen Termin, gesonderte Belehrung für Geschenkkörbe."
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
              <p className="mt-4">
                <strong>Geschenkkörbe:</strong> Für den Kauf von Geschenkkörben in unserem Online-Shop
                gilt die gesonderte Widerrufsbelehrung für Waren weiter unten.
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

            <section id="geschenkkoerbe" className="scroll-mt-32 mt-12 pt-8 border-t border-border">
              <h2 className="text-2xl font-serif font-semibold text-foreground mt-8 mb-3">
                Widerrufsbelehrung für den Kauf von Geschenkkörben (Waren)
              </h2>
              <h3 className="text-lg font-serif font-semibold text-foreground mt-6 mb-2">
                Widerrufsrecht
              </h3>
              <p>
                Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
              </p>
              <p>
                Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag, an dem Sie oder ein von Ihnen
                benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw.
                hat. Holen Sie den Geschenkkorb im Restaurant ab, beginnt die Frist mit der Übergabe.
              </p>
              <p>
                Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Speranza GmbH, Karlstraße 47a,
                80333 München, Telefon: +49 89 51519696, E-Mail: info@events-storia.de) mittels einer
                eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren
                Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte
                Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
              </p>
              <p>
                Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung
                des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
              </p>
              <h3 className="text-lg font-serif font-semibold text-foreground mt-6 mb-2">
                Folgen des Widerrufs
              </h3>
              <p>
                Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen
                erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten,
                die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns
                angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens
                binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren
                Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir
                dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es
                sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden
                Ihnen wegen dieser Rückzahlung Entgelte berechnet. Haben Sie bei Abholung vor Ort
                bezahlt, erstatten wir bar oder per Überweisung.
              </p>
              <p>
                Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder
                bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem,
                welches der frühere Zeitpunkt ist.
              </p>
              <p>
                Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab
                dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns
                (Speranza GmbH, Karlstraße 47a, 80333 München) zurückzusenden oder während unserer
                Öffnungszeiten im Restaurant zu übergeben. Die Frist ist gewahrt, wenn Sie die Waren vor
                Ablauf der Frist von vierzehn Tagen absenden.
              </p>
              <p>Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.</p>
              <p>
                Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser
                Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise
                der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.
              </p>
              <h3 className="text-lg font-serif font-semibold text-foreground mt-6 mb-2">
                Ausschluss des Widerrufsrechts
              </h3>
              <p>Das Widerrufsrecht besteht nicht bei Verträgen</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  zur Lieferung von Waren, die schnell verderben können oder deren Verfallsdatum schnell
                  überschritten würde (§ 312g Abs. 2 Nr. 2 BGB);
                </li>
                <li>
                  zur Lieferung versiegelter Waren, die aus Gründen des Gesundheitsschutzes oder der
                  Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung
                  entfernt wurde (§ 312g Abs. 2 Nr. 3 BGB), etwa geöffnete Lebensmittel oder Getränke.
                </li>
              </ul>
              <p className="mt-4">
                Sind nur einzelne Bestandteile eines Geschenkkorbs geöffnet, gilt der Ausschluss nur für
                diese Bestandteile; für die übrigen Bestandteile können Sie den Vertrag widerrufen. Das
                Muster-Widerrufsformular unten können Sie auch für Geschenkkörbe verwenden (Waren,
                „erhalten am“). Weitere Regelungen stehen in § 41 unserer{" "}
                <LocalizedLink to="legal.terms" className="text-primary hover:underline">AGB</LocalizedLink>.
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
                Stand: 20. November 2026
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
