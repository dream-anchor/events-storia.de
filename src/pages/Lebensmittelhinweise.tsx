import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";

const Lebensmittelhinweise = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-12 text-center">
            Lebensmittelinformationen
          </h1>
          <p className="text-center text-muted-foreground mb-12">
            Informationen gemäß EU-Lebensmittelinformationsverordnung (LMIV)
          </p>
          
          <div className="prose prose-lg max-w-none space-y-8 text-foreground/90">
            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                1. Allergene gemäß EU-LMIV Art. 9
              </h2>
              <p>
                Unsere Speisen können folgende kennzeichnungspflichtige Allergene enthalten. 
                Bitte informieren Sie unser Servicepersonal vor der Bestellung über Ihre Allergien 
                oder Unverträglichkeiten.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>A - Gluten</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Weizen, Roggen, Gerste, Hafer, Dinkel, Kamut
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>B - Krebstiere</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Krabben, Garnelen, Hummer, Langusten
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>C - Eier</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Alle Erzeugnisse aus Eiern
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>D - Fisch</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Alle Fischarten und Erzeugnisse daraus
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>E - Erdnüsse</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Erdnüsse und Erdnusserzeugnisse
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>F - Soja</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sojabohnen und Erzeugnisse daraus
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>G - Milch</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Milch und Milcherzeugnisse (einschließlich Laktose)
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>H - Schalenfrüchte</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Mandeln, Haselnüsse, Walnüsse, Cashew, Pistazien, etc.
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>I - Sellerie</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sellerie und Erzeugnisse daraus
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>J - Senf</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Senf und Senferzeugnisse
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>K - Sesam</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sesamsamen und Erzeugnisse daraus
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>L - Sulfite</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Schwefeldioxid und Sulfite (&gt;10mg/kg oder l)
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>M - Lupinen</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lupinen und Erzeugnisse daraus
                  </p>
                </div>
                <div className="p-4 bg-secondary/30 rounded-lg border border-border">
                  <strong>N - Weichtiere</strong>
                  <p className="text-sm text-muted-foreground mt-1">
                    Muscheln, Schnecken, Tintenfisch, etc.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                2. Zusatzstoffe
              </h2>
              <p>
                Nach deutschem Lebensmittelrecht sind folgende Zusatzstoffe kennzeichnungspflichtig:
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-4">
                <li><strong>1</strong> - mit Farbstoff</li>
                <li><strong>2</strong> - mit Konservierungsstoff</li>
                <li><strong>3</strong> - mit Antioxidationsmittel</li>
                <li><strong>4</strong> - mit Geschmacksverstärker</li>
                <li><strong>5</strong> - geschwärzt</li>
                <li><strong>6</strong> - mit Phosphat</li>
                <li><strong>7</strong> - mit Süßungsmittel</li>
                <li><strong>8</strong> - koffeinhaltig</li>
                <li><strong>9</strong> - chininhaltig</li>
                <li><strong>10</strong> - enthält eine Phenylalaninquelle</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                3. Weitere Kennzeichnungen
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Fleischherkunft:</strong> Die Herkunft unseres Fleisches wird gemäß 
                  den gesetzlichen Vorgaben ausgewiesen. Bei Fragen wenden Sie sich bitte an 
                  unser Servicepersonal.
                </li>
                <li>
                  <strong>Tiefkühlware:</strong> Gerichte, die aus zuvor tiefgefrorener Ware 
                  zubereitet werden, sind entsprechend gekennzeichnet (*).
                </li>
                <li>
                  <strong>Alkoholgehalt:</strong> Der Alkoholgehalt alkoholischer Getränke 
                  ist auf der Getränkekarte ausgewiesen.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                4. Hinweis zu Kreuzkontaminationen
              </h2>
              <p>
                In unserer Küche werden verschiedene Allergene verarbeitet. Trotz größter 
                Sorgfalt können wir Kreuzkontaminationen nicht vollständig ausschließen. 
                Wenn Sie unter schweren Allergien leiden, informieren Sie uns bitte vor 
                Ihrer Bestellung.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-serif font-semibold text-foreground mt-8 mb-3">
                5. Auskunft
              </h2>
              <p>
                Detaillierte Informationen zu Allergenen und Zusatzstoffen in unseren Speisen 
                erhalten Sie auf Anfrage von unserem Servicepersonal. Die vollständige 
                Allergenkennzeichnung liegt im Restaurant aus.
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

export default Lebensmittelhinweise;
