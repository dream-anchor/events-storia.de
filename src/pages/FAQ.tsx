import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingActions from "@/components/FloatingActions";
import SEO from "@/components/SEO";
import StructuredData from "@/components/StructuredData";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LocalizedLink } from "@/components/LocalizedLink";

interface FAQQuestion {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  questions: FAQQuestion[];
}

const faqCategories: FAQCategory[] = [
  {
    title: "Allgemeines zum Catering",
    questions: [
      {
        question: "Was ist STORIA Catering?",
        answer: "STORIA Catering ist der Catering-Service des Ristorante STORIA in der Karlstrasse 47a, 80333 München. Wir bieten authentische italienische Küche für Ihre Veranstaltungen – von hausgemachten Antipasti und Fingerfood-Buffets bis hin zu kompletten Menüs für Firmenfeiern, Hochzeiten und private Events."
      },
      {
        question: "Wer steht hinter STORIA Catering?",
        answer: "Hinter STORIA Catering steht die Speranza GmbH mit Geschäftsführerin Agnese Lettieri. Unser erfahrenes Küchenteam bereitet alle Gerichte frisch und mit hochwertigen Zutaten zu – dieselbe Qualität, die Gäste aus unserem Restaurant kennen."
      },
      {
        question: "Seit wann gibt es STORIA Catering?",
        answer: "Das Ristorante STORIA ist seit vielen Jahren eine feste Größe in der Münchner Gastronomieszene. Der Catering-Service ist eine natürliche Erweiterung unseres Angebots, um die Qualität unserer Küche auch außerhalb des Restaurants erlebbar zu machen."
      },
      {
        question: "Was unterscheidet STORIA Catering von anderen Anbietern?",
        answer: "Bei uns bekommen Sie echte italienische Küche – keine Massenware, sondern frisch zubereitete Gerichte nach traditionellen Rezepten. Wir legen Wert auf hochwertige Zutaten, authentische Aromen und eine persönliche Beratung für jede Veranstaltung."
      }
    ]
  },
  {
    title: "Angebot & Speisen",
    questions: [
      {
        question: "Welche Catering-Kategorien bietet STORIA an?",
        answer: "Wir bieten fünf Hauptkategorien: Fingerfood-Buffet mit kleinen Häppchen und Antipasti, Buffet-Platten mit Aufschnitt, Käse und mediterranen Spezialitäten, Auflauf & Ofengerichte für warme Buffets, original neapolitanische Pizze und hausgemachte Desserts wie Tiramisu oder Panna Cotta."
      },
      {
        question: "Gibt es vegetarische oder vegane Optionen?",
        answer: "Ja, wir bieten eine große Auswahl an vegetarischen Gerichten wie Caprese, Bruschetta, Gemüse-Antipasti, vegetarische Pizzen und Desserts. Vegane Optionen sind auf Anfrage ebenfalls möglich – sprechen Sie uns bei der Bestellung einfach an."
      },
      {
        question: "Kann ich individuelle Menüs zusammenstellen?",
        answer: "Selbstverständlich! Für größere Events erstellen wir gerne ein individuelles Angebot nach Ihren Wünschen. Nutzen Sie unser Kontaktformular oder rufen Sie uns an – wir beraten Sie persönlich."
      },
      {
        question: "Wie groß sind die Portionen? Wieviel muss ich pro Person bestellen?",
        answer: "Unsere Portionsgrößen sind auf Erfahrungswerten basiert: Fingerfood rechnen wir mit 8-10 Stück pro Person, Buffet-Platten mit ca. 150-200g pro Person. Bei der Bestellung geben wir Empfehlungen basierend auf Ihrer Gästezahl und Veranstaltungsart."
      },
      {
        question: "Woher kommen die Zutaten?",
        answer: "Wir beziehen unsere Zutaten von ausgewählten Lieferanten – viele Produkte kommen direkt aus Italien: Mozzarella di Bufala, San Marzano Tomaten, original italienische Salumi und Käsesorten. Frische Zutaten wie Gemüse und Kräuter beziehen wir regional."
      },
      {
        question: "Sind Allergene und Zusatzstoffe ausgewiesen?",
        answer: "Ja, alle Allergene und Zusatzstoffe sind in unserer Speisekarte und auf der Website gekennzeichnet. Bei speziellen Unverträglichkeiten oder Allergien kontaktieren Sie uns bitte vorab, damit wir Sie individuell beraten können."
      },
      {
        question: "Bietet ihr auch glutenfreie Gerichte an?",
        answer: "Einige unserer Gerichte sind von Natur aus glutenfrei (z.B. bestimmte Antipasti, Salate). Bitte teilen Sie uns Ihre Anforderungen bei der Bestellung mit, damit wir passende Optionen für Sie auswählen können."
      },
      {
        question: "Wie werden die Speisen geliefert – warm oder kalt?",
        answer: "Die meisten Catering-Gerichte werden kühlfrisch geliefert und können vor Ort erwärmt werden (Anleitungen liegen bei). Warme Lieferung ist für bestimmte Gerichte und größere Events auf Anfrage möglich."
      },
      {
        question: "Wie lange sind die Speisen haltbar?",
        answer: "Unsere frischen Speisen sollten am Liefertag oder spätestens am Folgetag verzehrt werden. Genaue Haltbarkeitshinweise finden Sie auf der Verpackung. Kühl lagern bis zum Servieren."
      }
    ]
  },
  {
    title: "Preise & Mindestbestellungen",
    questions: [
      {
        question: "In welcher Preisspanne liegt das Catering?",
        answer: "Unsere Preise variieren je nach Kategorie: Fingerfood ab ca. 3-5 € pro Stück, Buffet-Platten ab ca. 25-45 € pro Platte, Pizzen ab 12-18 € pro Pizza (für 2-3 Personen). Für größere Events erstellen wir individuelle Angebote."
      },
      {
        question: "Gibt es einen Mindestbestellwert?",
        answer: "Ja, der Mindestbestellwert für Catering-Lieferungen beträgt 150 €. Dies ermöglicht uns, die gewohnte Qualität und Frische zu gewährleisten."
      },
      {
        question: "Sind die Preise inkl. oder exkl. MwSt.?",
        answer: "Alle angegebenen Preise auf unserer Website verstehen sich inklusive der gesetzlichen Mehrwertsteuer (7% für Speisen zur Abholung/Lieferung)."
      },
      {
        question: "Gibt es Rabatte für größere Bestellungen?",
        answer: "Für Großbestellungen und regelmäßige Firmenbestellungen bieten wir gerne individuelle Konditionen. Kontaktieren Sie uns für ein maßgeschneidertes Angebot."
      },
      {
        question: "Was kostet die Lieferung?",
        answer: "Die Lieferkosten hängen von der Entfernung und dem Bestellwert ab. Innerhalb Münchens (Stadtgebiet) liegen die Lieferkosten zwischen 15-35 €. Ab einem bestimmten Bestellwert ist die Lieferung kostenfrei – fragen Sie nach den aktuellen Konditionen."
      }
    ]
  },
  {
    title: "Ablauf & Buchung",
    questions: [
      {
        question: "Wie kann ich Catering bestellen?",
        answer: "Sie können direkt über unseren Online-Shop bestellen, uns per E-Mail (info@events-storia.de) kontaktieren oder telefonisch unter +49 89 51519696 erreichen. Für größere Events empfehlen wir eine persönliche Beratung."
      },
      {
        question: "Wie viel Vorlaufzeit braucht ihr für eine Bestellung?",
        answer: "Für Standardbestellungen benötigen wir mindestens 48 Stunden Vorlaufzeit. Für größere Events, individuelle Menüs oder Wochenendlieferungen empfehlen wir eine Buchung mindestens 1-2 Wochen im Voraus."
      },
      {
        question: "Kann ich eine Bestellung ändern oder stornieren?",
        answer: "Änderungen sind bis 48 Stunden vor dem Liefertermin kostenlos möglich. Stornierungen bis 48 Stunden vorher: kostenfrei. Bei späteren Stornierungen können Gebühren anfallen. Details finden Sie in unseren AGB."
      },
      {
        question: "Bekomme ich eine Auftragsbestätigung?",
        answer: "Ja, nach jeder Bestellung erhalten Sie eine schriftliche Auftragsbestätigung per E-Mail mit allen Details zu Ihrer Bestellung, Liefertermin und Zahlungsinformationen."
      }
    ]
  },
  {
    title: "Lieferung & Abholung",
    questions: [
      {
        question: "In welche Gebiete liefert STORIA Catering?",
        answer: "Wir liefern in ganz München und Umgebung (ca. 30 km Radius). Dazu gehören u.a.: Schwabing, Maxvorstadt, Bogenhausen, Haidhausen, Sendling, Pasing, Freising, Unterschleißheim, Garching, Unterföhring, Ismaning, Grünwald und Pullach. Bei Fragen zu Ihrem Standort kontaktieren Sie uns."
      },
      {
        question: "Kann ich die Bestellung auch selbst abholen?",
        answer: "Ja, Selbstabholung ist möglich in unserem Restaurant: Karlstraße 47a, 80333 München. Bitte geben Sie bei der Bestellung an, dass Sie selbst abholen möchten, und vereinbaren Sie einen Abholtermin."
      },
      {
        question: "Wann erfolgt die Lieferung?",
        answer: "Catering-Lieferungen erfolgen in der Regel am Morgen des Veranstaltungstages oder nach Absprache. Den genauen Lieferzeitraum legen wir gemeinsam mit Ihnen fest."
      }
    ]
  },
  {
    title: "Events & Feiern",
    questions: [
      {
        question: "Für welche Anlässe eignet sich STORIA Catering?",
        answer: "Unser Catering passt zu vielen Anlässen: Firmenfeiern, Meetings, Konferenzen, Geburtstage, Hochzeiten, Taufen, Jubiläen, Gartenpartys, Weihnachtsfeiern und private Dinner. Wir beraten Sie gerne, welche Optionen für Ihre Feier am besten passen."
      },
      {
        question: "Kann ich auch im Restaurant feiern?",
        answer: "Ja! Das Ristorante STORIA kann für private Events gemietet werden – von kleinen Gruppen bis zur exklusiven Nutzung des gesamten Restaurants. Besuchen Sie unsere Events-Seite für Details oder kontaktieren Sie uns direkt."
      },
      {
        question: "Bietet ihr Full-Service-Catering mit Personal?",
        answer: "Für größere Events bieten wir auf Anfrage Full-Service-Catering mit Servicepersonal, Aufbau und Abbau. Kontaktieren Sie uns für ein individuelles Angebot."
      }
    ]
  },
  {
    title: "Service, Personal & Equipment",
    questions: [
      {
        question: "Kann ich Servicepersonal dazubuchen?",
        answer: "Ja, für größere Events bieten wir professionelles Servicepersonal an. Die Kosten richten sich nach Dauer, Personenzahl und Umfang des Services. Sprechen Sie uns bei der Bestellung darauf an."
      },
      {
        question: "Stellt ihr Equipment wie Geschirr oder Wärmeplatten?",
        answer: "Auf Anfrage können wir Equipment wie Warmhalteplatten, Servierschalen oder Besteck bereitstellen. Diese werden separat berechnet. Standard-Catering wird in hochwertigen Einweg- oder Mehrwegbehältern geliefert."
      },
      {
        question: "Holt ihr das Leihequipment wieder ab?",
        answer: "Ja, Leihequipment wird nach dem Event zu einem vereinbarten Termin wieder abgeholt. Die Rückholung ist in der Leihgebühr enthalten."
      }
    ]
  },
  {
    title: "Zahlung & Hinweise",
    questions: [
      {
        question: "Welche Zahlungsmethoden werden akzeptiert?",
        answer: "Sie können per Kreditkarte, PayPal, Überweisung oder bei Abholung/Lieferung bar bezahlen. Für Firmenkunden bieten wir auch Rechnungskauf nach vorheriger Vereinbarung."
      },
      {
        question: "Benötigt ihr eine Anzahlung?",
        answer: "Für größere Events oder individuelle Bestellungen kann eine Anzahlung von 30-50% erforderlich sein. Dies wird vorab mit Ihnen abgestimmt und in der Auftragsbestätigung festgehalten."
      }
    ]
  },
  {
    title: "Kontakt & Beratung",
    questions: [
      {
        question: "Wie erreiche ich STORIA Catering am schnellsten?",
        answer: "Am schnellsten erreichen Sie uns telefonisch unter +49 89 51519696 (während unserer Öffnungszeiten) oder per E-Mail an info@events-storia.de. Wir antworten in der Regel innerhalb von 24 Stunden."
      },
      {
        question: "Wann ist die beste Zeit für eine Beratung?",
        answer: "Telefonische Beratung ist am besten außerhalb der Hauptgeschäftszeiten (vor 12 Uhr oder nach 14 Uhr). Alternativ können Sie uns jederzeit per E-Mail kontaktieren, und wir rufen Sie gerne zurück."
      },
      {
        question: "Bietet ihr eine Verkostung vor der Buchung an?",
        answer: "Für größere Events (z.B. Hochzeiten, große Firmenfeiern) bieten wir nach Absprache eine Verkostung im Restaurant an. Kontaktieren Sie uns für Details und Terminvereinbarung."
      }
    ]
  }
];

// Collect all FAQ items for StructuredData
const allFaqItems = faqCategories.flatMap(category =>
  category.questions.map(q => ({
    question: q.question,
    answer: q.answer,
  }))
);

const FAQ = () => {
  return (
    <>
      <SEO
        title="FAQ – Häufig gestellte Fragen | STORIA Catering München"
        description="Antworten auf häufige Fragen zu STORIA Catering: Preise, Mindestbestellungen, Liefergebiet München, Speisen, Buchungsablauf und mehr."
        canonical="/faq-catering-muenchen"
        noIndex={false}
      />

      <StructuredData
        type="faq"
        faqItems={allFaqItems}
        breadcrumbs={[
          { name: 'Home', url: '/' },
          { name: 'FAQ', url: '/faq-catering-muenchen' },
        ]}
      />

      <div className="min-h-screen bg-background">
        <Header />

        <main className="pt-32 pb-20 px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-serif font-semibold text-foreground mb-6 text-center">
              Häufig gestellte Fragen
            </h1>

            <p className="text-lg text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              Hier finden Sie Antworten auf die wichtigsten Fragen rund um STORIA Catering.
              Ihre Frage ist nicht dabei?{" "}
              <LocalizedLink to="contact" className="text-primary hover:underline">
                Kontaktieren Sie uns
              </LocalizedLink>
              .
            </p>

            <div className="space-y-10">
              {faqCategories.map((category, categoryIndex) => (
                <section key={categoryIndex}>
                  <h2 className="text-2xl font-serif font-semibold text-foreground mb-4">
                    {category.title}
                  </h2>

                  <Accordion type="single" collapsible className="w-full">
                    {category.questions.map((item, questionIndex) => (
                      <AccordionItem
                        key={questionIndex}
                        value={`${categoryIndex}-${questionIndex}`}
                      >
                        <AccordionTrigger className="text-left text-base font-medium">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent forceMount className="text-muted-foreground leading-relaxed">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              ))}
            </div>

            {/* CTA Section */}
            <div className="mt-16 p-8 bg-muted/30 rounded-lg text-center">
              <h3 className="text-xl font-serif font-semibold text-foreground mb-3">
                Haben Sie weitere Fragen?
              </h3>
              <p className="text-muted-foreground mb-6">
                Unser Team berät Sie gerne persönlich zu Ihrem Event.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  to="/kontakt"
                  className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                >
                  Kontakt aufnehmen
                </Link>
                <a
                  href="tel:+498951519696"
                  className="inline-flex items-center justify-center px-6 py-3 border border-primary text-primary rounded-lg hover:bg-primary/5 transition-colors font-medium"
                >
                  +49 89 51519696
                </a>
              </div>
            </div>
          </div>
        </main>

        <Footer />
        <FloatingActions />
      </div>
    </>
  );
};

export default FAQ;
