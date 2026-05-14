import type { OfferLang } from "@/lib/offerLang";

/**
 * Statische UI-Texte für die öffentliche Angebotsseite.
 * Wird vom Sprachumschalter im Public-Offer verwendet.
 * Dynamische Inhalte (Menü, Anschreiben) werden separat übersetzt.
 */
export const OFFER_UI: Record<OfferLang, Record<string, string>> = {
  de: {
    language: 'Sprache',
    galleryEyebrow: 'Ristorante Storia · München-Maxvorstadt',
    galleryTitle: 'Lernen Sie unser Haus kennen',
    gallerySubtitle: 'Ein kurzer Eindruck von unserem Haus und der Atmosphäre – tippen Sie auf ein Bild für die Großansicht.',
    galleryCaption1: 'Ristorante Storia · München-Maxvorstadt',
    galleryCaption2: 'Räume & Atmosphäre',
    translatingLetter: 'Übersetzung wird geladen…',
    translationFailed: 'Übersetzung nicht verfügbar — Originaltext wird angezeigt.',
  },
  en: {
    language: 'Language',
    galleryEyebrow: 'Ristorante Storia · Munich-Maxvorstadt',
    galleryTitle: 'Get to know our house',
    gallerySubtitle: 'A brief impression of our restaurant and atmosphere – tap an image to enlarge.',
    galleryCaption1: 'Ristorante Storia · Munich-Maxvorstadt',
    galleryCaption2: 'Rooms & atmosphere',
    translatingLetter: 'Loading translation…',
    translationFailed: 'Translation unavailable — showing original text.',
  },
  it: {
    language: 'Lingua',
    galleryEyebrow: 'Ristorante Storia · Monaco-Maxvorstadt',
    galleryTitle: 'Scoprite la nostra casa',
    gallerySubtitle: 'Una breve impressione del nostro ristorante e della sua atmosfera – tocca un\'immagine per ingrandirla.',
    galleryCaption1: 'Ristorante Storia · Monaco-Maxvorstadt',
    galleryCaption2: 'Sale e atmosfera',
    translatingLetter: 'Caricamento traduzione…',
    translationFailed: 'Traduzione non disponibile — viene mostrato il testo originale.',
  },
  fr: {
    language: 'Langue',
    galleryEyebrow: 'Ristorante Storia · Munich-Maxvorstadt',
    galleryTitle: 'Découvrez notre maison',
    gallerySubtitle: 'Un aperçu de notre restaurant et de son ambiance – touchez une image pour l\'agrandir.',
    galleryCaption1: 'Ristorante Storia · Munich-Maxvorstadt',
    galleryCaption2: 'Salles & ambiance',
    translatingLetter: 'Chargement de la traduction…',
    translationFailed: 'Traduction indisponible — texte original affiché.',
  },
};

export function tOffer(lang: OfferLang, key: string): string {
  return OFFER_UI[lang]?.[key] ?? OFFER_UI.de[key] ?? key;
}