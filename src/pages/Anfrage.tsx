import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { AnfrageJsonLd } from "./anfrage/JsonLd";
import { FunnelSlot } from "./anfrage/FunnelSlot";
import { ErwartungBlock } from "./anfrage/StaticContent";
import { AnlassCards } from "./anfrage/AnlassCards";
import { FaqBlock } from "./anfrage/FaqBlock";
import { KontaktBlock } from "./anfrage/KontaktBlock";

const Anfrage = () => {
  return (
    <>
      <SEO
        title="Anfrage senden — Events & Catering im Storia München | Karlstraße 47a"
        description="Unverbindliche Anfrage für Firmenfeier, Hochzeit, Geburtstag oder Catering im Storia München-Maxvorstadt. Persönliche Rückmeldung innerhalb von 4 Stunden."
        canonical="/anfrage"
        type="website"
        alternateUrl={undefined}
      />
      <AnfrageJsonLd />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-10 md:py-16 max-w-5xl space-y-14 md:space-y-20">
            {/* Hero */}
            <header className="space-y-4 max-w-3xl">
              <h1 className="text-3xl md:text-5xl font-serif font-bold tracking-tight leading-[1.1]">
                Anfrage für Event, Catering oder Beratung — Storia München
              </h1>
              <p className="text-lg md:text-xl text-foreground/75 leading-relaxed">
                Sagen Sie uns in 60 Sekunden, was Sie planen.
                <br className="hidden sm:inline" /> Wir melden uns innerhalb von 4 Stunden persönlich.
              </p>
            </header>

            <FunnelSlot />
            <ErwartungBlock />
            <AnlassCards />
            <FaqBlock />
            <KontaktBlock />
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Anfrage;
