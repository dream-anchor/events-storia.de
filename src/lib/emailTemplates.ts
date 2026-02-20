/**
 * STORIA E-Mail Template System
 *
 * Rendert E-Mail-Vorlagen mit bedingter Logik:
 * - Fehlende Werte → Textteile werden weggelassen
 * - Dynamischer Eventdetails-Satz aus vorhandenen Daten
 * - Tafelhinweis nach Gästeanzahl (nur Template 1)
 * - Checkliste nur wenn Infos fehlen (nur Template 3)
 */

// --- Types ---

export type TemplateName =
  | 'gruppenreservierung'
  | 'business_aperitivo'
  | 'exklusive_location';

export interface TemplateContext {
  // Anfrage-Daten (alle optional)
  kundenname?: string;
  firma?: string;
  eventdatum?: string;   // ISO-Datum oder formatiert
  gaeste?: string;       // z.B. "50"
  eventart?: string;
  raum?: string;
  zeitfenster?: string;

  // Angebots-Optionen (aus OfferBuilder)
  options?: TemplateOption[];
}

export interface TemplateOption {
  label: string;           // "A", "B", etc.
  packageName?: string;
  guestCount: number;
  totalAmount: number;
  courses: TemplateCourse[];
  drinks: TemplateDrink[];
}

export interface TemplateCourse {
  courseType: string;
  courseLabel: string;
  itemName: string;
}

export interface TemplateDrink {
  drinkGroup: string;
  drinkLabel: string;
  selectedChoice: string;
}

// --- Template-Definitionen ---

interface TemplateDefinition {
  name: TemplateName;
  label: string;
  description: string;
}

export const STORIA_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'gruppenreservierung',
    label: 'Gruppenreservierung',
    description: 'Für Gruppen ab 6 Personen — À-la-carte, Tafel & Menü',
  },
  {
    name: 'business_aperitivo',
    label: 'Business / Network-Aperitivo',
    description: 'Lockere Business-Events und Networking',
  },
  {
    name: 'exklusive_location',
    label: 'Exklusive Location',
    description: 'Große Events mit Exklusivnutzung',
  },
];

// --- Hilfsfunktionen ---

/** Datum formatieren: ISO → "Samstag, 15. März 2026" */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** Betrag formatieren: 1250 → "1.250,00 €" */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
  });
}

/** Gang-Labels (deutsch) */
const COURSE_LABELS: Record<string, string> = {
  starter: 'Antipasto',
  pasta: 'Pasta',
  main: 'Hauptgang',
  main_fish: 'Fisch',
  main_meat: 'Fleisch',
  dessert: 'Dessert',
  fingerfood: 'Fingerfood',
  side: 'Beilage',
  soup: 'Suppe',
};

/** Getränke-Labels (deutsch) */
const DRINK_LABELS: Record<string, string> = {
  aperitif: 'Aperitif',
  main_drink: 'Weinbegleitung',
  water: 'Wasser',
  coffee: 'Kaffee',
  digestif: 'Digestif',
};

// --- Shared Blocks ---

/** Signatur-Block */
function buildSignatur(): string {
  return [
    'Für Rückfragen oder eine persönliche Abstimmung erreichen Sie uns jederzeit direkt:',
    '',
    'Domenico Speranza – 0163 6033912',
    'Madina Khader – 0179 2200921',
    '',
    'Wir freuen uns darauf, Ihr Event gemeinsam mit Ihnen zu realisieren.',
    '',
    'Mit freundlichen Grüßen',
    '',
    'Domenico Speranza',
    'Madina Khader',
    '',
    'STORIA',
    'Karlstraße 47a',
    '80333 München',
  ].join('\n');
}

/**
 * Baut den Eventdetails-Satz dynamisch aus vorhandenen Werten.
 * Voll: "für Ihre Firmenfeier am Samstag, 15. März 2026 um 18:00 Uhr für 50 Personen im Runden Raum"
 * Minimal: "für Ihre Veranstaltung"
 */
function buildEventDetailsSatz(ctx: TemplateContext): string {
  const parts: string[] = [];

  // "für Ihre Firmenfeier" oder "für Ihre Veranstaltung"
  parts.push(`für Ihre ${ctx.eventart || 'Veranstaltung'}`);

  // "am Samstag, 15. März 2026"
  if (ctx.eventdatum) {
    parts.push(`am ${formatDate(ctx.eventdatum)}`);
  }

  // "um 18:00 Uhr"
  if (ctx.zeitfenster) {
    parts.push(`um ${ctx.zeitfenster} Uhr`);
  }

  // "für 50 Personen"
  if (ctx.gaeste) {
    parts.push(`für ${ctx.gaeste} Personen`);
  }

  // "im Runden Raum"
  if (ctx.raum) {
    parts.push(`im ${ctx.raum}`);
  }

  return parts.join(' ');
}

/**
 * Tafelhinweis basierend auf Gästeanzahl (nur Template 1).
 * ≤12: "eine lange gemeinsame Tafel"
 * 13–24: "zwei lange Tafeln nebeneinander"
 * >24: "mehrere Tafeln"
 * Kein guest_count: leerer String (Absatz fällt weg)
 */
function buildTafelhinweis(ctx: TemplateContext): string {
  const count = parseInt(ctx.gaeste || '', 10);
  if (!count || isNaN(count)) return '';

  let tafel: string;
  if (count <= 12) {
    tafel = 'eine lange gemeinsame Tafel';
  } else if (count <= 24) {
    tafel = 'zwei lange Tafeln nebeneinander';
  } else {
    tafel = 'mehrere Tafeln';
  }

  return `Für Ihre Gruppe richten wir ${tafel} her. `;
}

/**
 * Checkliste für fehlende Informationen (nur Template 3).
 * Bereits bekannte Punkte werden entfernt.
 */
function buildCheckliste(ctx: TemplateContext): string {
  const missing: string[] = [];

  if (!ctx.eventdatum) missing.push('Gewünschtes Datum und Zeitraum');
  if (!ctx.gaeste) missing.push('Geplante Personenanzahl');
  if (!ctx.eventart) missing.push('Art des Events');
  // Immer hinzufügen (können nicht aus Anfrage abgeleitet werden)
  missing.push('Gewünschtes Catering-Format');
  missing.push('Technischer Bedarf');
  missing.push('Gewünschtes Branding oder besondere Gestaltungselemente');

  if (missing.length === 0) return '';

  return [
    'Für die Ausarbeitung eines konkreten Angebots freuen wir uns über folgende Informationen:',
    '',
    ...missing.map(item => `  • ${item}`),
  ].join('\n');
}

/** Anrede — dynamisch mit Fallback */
function buildAnrede(ctx: TemplateContext): string {
  if (ctx.kundenname) {
    return `Sehr geehrte/r ${ctx.kundenname},`;
  }
  return 'Sehr geehrte Damen und Herren,';
}

/** Menü einer Option — Speisekarten-Stil */
function formatMenuText(option: TemplateOption): string {
  if (option.courses.length === 0) return '';
  return option.courses
    .map(c => {
      const label = c.courseLabel || COURSE_LABELS[c.courseType] || c.courseType;
      return `  ${label}\n  ${c.itemName}`;
    })
    .join('\n\n');
}

/** Getränke einer Option — Speisekarten-Stil */
function formatDrinksText(option: TemplateOption): string {
  if (option.drinks.length === 0) return '';
  return option.drinks
    .map(d => {
      const label = d.drinkLabel || DRINK_LABELS[d.drinkGroup] || d.drinkGroup;
      return `  ${label}: ${d.selectedChoice}`;
    })
    .join('\n');
}

/** Alle aktiven Optionen als Block rendern */
function renderOptionBlock(options: TemplateOption[]): string {
  if (!options || options.length === 0) return '';

  const isSingle = options.length === 1;

  return options.map(opt => {
    const lines: string[] = [];

    // Bei nur 1 Option: kein "Option A" Label, nur Paketname
    const header = isSingle
      ? (opt.packageName || 'Ihr Angebot')
      : opt.packageName
        ? `Option ${opt.label} – ${opt.packageName}`
        : `Option ${opt.label}`;
    lines.push(header);
    lines.push('─'.repeat(header.length));

    // Menü im Speisekarten-Stil
    const menu = formatMenuText(opt);
    if (menu) {
      lines.push('');
      lines.push(menu);
      lines.push('');
    }

    // Getränke
    const drinks = formatDrinksText(opt);
    if (drinks) {
      lines.push('  Getränkebegleitung');
      lines.push(drinks);
      lines.push('');
    }

    // Preis — immer pro Person
    if (opt.totalAmount > 0 && opt.guestCount > 0) {
      lines.push(`  ${formatCurrency(opt.totalAmount / opt.guestCount)} pro Person`);
    }

    return lines.join('\n');
  }).join('\n\n');
}

// --- Template-Renderer ---

function renderGruppenreservierung(ctx: TemplateContext): string {
  const eventSatz = buildEventDetailsSatz(ctx);
  const tafel = buildTafelhinweis(ctx);
  const optionen = renderOptionBlock(ctx.options || []);

  const lines: string[] = [
    buildAnrede(ctx),
    '',
    `herzlichen Dank für Ihre Anfrage ${eventSatz}.`,
    'Wir freuen uns sehr darauf, Sie und Ihre Gäste bei uns im STORIA begrüßen zu dürfen.',
    '',
    'Um einen reibungslosen Ablauf und den bestmöglichen Service zu gewährleisten, bieten wir Ihnen folgende Möglichkeiten an:',
    '',
    'À-la-carte-Service',
    'Gerne bereiten wir Tische für Ihre Gruppe vor, sodass alle gemeinsam sitzen und individuell aus unserer Speisekarte wählen können.',
    '',
    'Lange Tafel mit Vorspeisen',
    `${tafel}Wir servieren zu Beginn eine gemischte Vorspeisenplatte (auf Wunsch auch vegetarisch oder vegan) zum Preis von 21,40 € zzgl. gesetzlicher MwSt. pro Person. Im Anschluss können die Hauptgänge à la carte gewählt werden.`,
  ];

  // Optionen-Block nur wenn konfiguriert
  if (optionen) {
    lines.push('', optionen);
  }

  lines.push(
    '',
    'Weitere Möglichkeiten sowie attraktive Pakete inklusive Getränke finden Sie unter: https://www.events-storia.de/events',
    '',
    'Gerne freuen wir uns über Ihre Rückmeldung, für welche Variante Sie sich entscheiden möchten, damit wir alles optimal vorbereiten können.',
    '',
    buildSignatur(),
  );

  return lines.join('\n');
}

function renderBusinessAperitivo(ctx: TemplateContext): string {
  const eventSatz = buildEventDetailsSatz(ctx);
  const optionen = renderOptionBlock(ctx.options || []);

  const lines: string[] = [
    buildAnrede(ctx),
    '',
    `vielen Dank für Ihre Anfrage und Ihr Interesse an einer Veranstaltung im STORIA. Gerne stellen wir Ihnen unser Business-Format ${eventSatz} vor.`,
  ];

  if (optionen) {
    lines.push('', optionen);
  }

  lines.push(
    '',
    'Dieses Format eignet sich ideal für lockere Business-Events oder Networking-Veranstaltungen in kommunikativer Atmosphäre.',
    '',
    'Weitere Möglichkeiten sowie attraktive Pakete inklusive Getränke finden Sie unter: https://www.events-storia.de/events',
    '',
    buildSignatur(),
  );

  return lines.join('\n');
}

function renderExklusiveLocation(ctx: TemplateContext): string {
  const eventSatz = buildEventDetailsSatz(ctx);
  const optionen = renderOptionBlock(ctx.options || []);
  const checkliste = buildCheckliste(ctx);

  const lines: string[] = [
    buildAnrede(ctx),
    '',
    'vielen Dank für Ihre Anfrage und Ihr Interesse an einer exklusiven Veranstaltung im STORIA.',
    '',
    `Gerne stellen wir Ihnen unser Paket ${eventSatz} vor.`,
  ];

  if (optionen) {
    lines.push('', optionen);
  }

  lines.push(
    '',
    'Dieses Format eignet sich ideal für Firmenfeiern, Jahresauftaktveranstaltungen, Produktpräsentationen oder exklusive Kundenevents.',
    '',
    'Gerne passen wir das Konzept individuell an Ihr Event an.',
  );

  if (checkliste) {
    lines.push('', checkliste);
  }

  lines.push('', buildSignatur());

  return lines.join('\n');
}

// --- Haupt-Export ---

/**
 * Rendert eine STORIA E-Mail-Vorlage mit den gegebenen Kontextdaten.
 * Alle Werte sind optional — fehlende Daten werden weggelassen.
 */
export function renderEmail(template: TemplateName, ctx: TemplateContext): string {
  switch (template) {
    case 'gruppenreservierung':
      return renderGruppenreservierung(ctx);
    case 'business_aperitivo':
      return renderBusinessAperitivo(ctx);
    case 'exklusive_location':
      return renderExklusiveLocation(ctx);
    default:
      return '';
  }
}
