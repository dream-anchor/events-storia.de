import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Wie schnell antwortet Storia auf eine Anfrage?",
    a: "Wir melden uns innerhalb von 4 Stunden persönlich bei Ihnen — meistens schneller. Bei Anfragen außerhalb unserer Öffnungszeiten (Mo–Fr 9–1 Uhr, Sa–So 12–1 Uhr) am nächsten Morgen. Eine automatische Bestätigung erhalten Sie sofort per E-Mail.",
  },
  {
    q: "Welche Anlässe richtet Storia aus?",
    a: "Firmenfeiern, Weihnachtsfeiern, Hochzeiten, Geburtstage, Jubiläen, Team-Events, Sommerfeste und private Feiern. Sowohl im Restaurant in der Karlstraße 47a als auch als Catering an Ihrem Ort. Für 2 bis über 100 Personen.",
  },
  {
    q: "Ist die Anfrage verbindlich?",
    a: "Nein. Eine Anfrage ist immer unverbindlich. Sie erhalten zuerst eine persönliche Beratung und ein transparentes Angebot, bevor irgendetwas gebucht wird.",
  },
  {
    q: "Wie viele Personen passen ins Storia?",
    a: "Innen und auf der Terrasse bieten wir jeweils bis zu 100 Sitzplätze oder 180 Stehplätze. Für die Exklusivmiete des gesamten Restaurants empfehlen wir mindestens 40 Personen. Catering liefern wir für Gruppen ab 10 Personen.",
  },
  {
    q: "Bietet Storia Catering in ganz München an?",
    a: "Ja. Wir liefern italienisches Catering in München und Umgebung — Fingerfood, Pizza Napoletana aus dem Steinofen, warme Aufläufe, Buffets und Desserts. Frisch zubereitet, zuverlässig geliefert.",
  },
  {
    q: "Kann ich auch ohne Online-Anfrage Kontakt aufnehmen?",
    a: "Selbstverständlich. Sie erreichen uns telefonisch unter +49 89 51519696, per E-Mail an info@events-storia.de oder per WhatsApp unter +49 163 603 3912. Persönlich vor Ort in der Karlstraße 47a, 80333 München.",
  },
];

export const FaqBlock = () => (
  <section aria-labelledby="anfrage-faq" className="space-y-5">
    <h2 id="anfrage-faq" className="text-2xl md:text-3xl font-serif font-bold tracking-tight">
      Häufige Fragen zur Anfrage
    </h2>
    <Accordion type="single" collapsible className="max-w-3xl">
      {FAQS.map((item, idx) => (
        <AccordionItem key={idx} value={`faq-${idx}`}>
          <AccordionTrigger className="text-left text-base md:text-lg font-medium">
            {item.q}
          </AccordionTrigger>
          <AccordionContent className="text-base leading-relaxed text-foreground/80">
            {item.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </section>
);
