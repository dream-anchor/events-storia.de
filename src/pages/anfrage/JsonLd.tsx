import { Helmet } from "react-helmet-async";

const contactPage = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: "Anfrage senden",
  url: "https://www.events-storia.de/anfrage",
  inLanguage: "de-DE",
  mainEntity: {
    "@type": "Restaurant",
    name: "Storia — Ristorante Pizzeria Bar",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Karlstraße 47a",
      postalCode: "80333",
      addressLocality: "München",
      addressRegion: "BY",
      addressCountry: "DE",
    },
    telephone: "+49 89 51519696",
    email: "info@events-storia.de",
    geo: { "@type": "GeoCoordinates", latitude: 48.1447, longitude: 11.5628 },
    url: "https://www.ristorantestoria.de/",
    servesCuisine: "Italian",
    priceRange: "€€",
  },
};

const faqPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Wie schnell antwortet Storia auf eine Anfrage?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Wir melden uns innerhalb von 24 Stunden persönlich bei Ihnen — meistens schneller. Bei Anfragen außerhalb unserer Öffnungszeiten (Mo–Fr 9–1 Uhr, Sa–So 12–1 Uhr) am nächsten Morgen. Eine automatische Bestätigung erhalten Sie sofort per E-Mail.",
      },
    },
    {
      "@type": "Question",
      name: "Welche Anlässe richtet Storia aus?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Firmenfeiern, Weihnachtsfeiern, Hochzeiten, Geburtstage, Jubiläen, Team-Events, Sommerfeste und private Feiern. Sowohl im Restaurant in der Karlstraße 47a als auch als Catering an Ihrem Ort. Für 2 bis über 100 Personen.",
      },
    },
    {
      "@type": "Question",
      name: "Ist die Anfrage verbindlich?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Nein. Eine Anfrage ist immer unverbindlich. Sie erhalten zuerst eine persönliche Beratung und ein transparentes Angebot, bevor irgendetwas gebucht wird.",
      },
    },
    {
      "@type": "Question",
      name: "Wie viele Personen passen ins Storia?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Innen und auf der Terrasse bieten wir jeweils bis zu 100 Sitzplätze oder 180 Stehplätze. Für die Exklusivmiete des gesamten Restaurants empfehlen wir mindestens 40 Personen. Catering liefern wir für Gruppen ab 10 Personen.",
      },
    },
    {
      "@type": "Question",
      name: "Bietet Storia Catering in ganz München an?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Ja. Wir liefern italienisches Catering in München und Umgebung — Fingerfood, Pizza Napoletana aus dem Steinofen, warme Aufläufe, Buffets und Desserts. Frisch zubereitet, zuverlässig geliefert.",
      },
    },
    {
      "@type": "Question",
      name: "Kann ich auch ohne Online-Anfrage Kontakt aufnehmen?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Selbstverständlich. Sie erreichen uns telefonisch unter +49 89 51519696, per E-Mail an info@events-storia.de oder per WhatsApp unter +49 163 603 3912. Persönlich vor Ort in der Karlstraße 47a, 80333 München.",
      },
    },
  ],
};

const breadcrumb = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Startseite", item: "https://www.events-storia.de/" },
    { "@type": "ListItem", position: 2, name: "Anfrage", item: "https://www.events-storia.de/anfrage" },
  ],
};

export const AnfrageJsonLd = () => (
  <Helmet>
    <script type="application/ld+json">{JSON.stringify(contactPage)}</script>
    <script type="application/ld+json">{JSON.stringify(faqPage)}</script>
    <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
  </Helmet>
);
