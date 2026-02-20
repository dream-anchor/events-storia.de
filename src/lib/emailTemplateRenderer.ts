/**
 * Universeller Template-Renderer für STORIA E-Mail-Vorlagen
 *
 * Nimmt jeden Template-String (aus DB) und ersetzt {{variablen}} durch echte Werte.
 * Unterstützt einfache Variablen ({{kundenname}}) und zusammengesetzte Blöcke
 * ({{eventdetails_satz}}, {{signatur}}, {{checkliste}}, {{tafelhinweis}}).
 *
 * Cleanup: Nicht ersetzte Variablen → entfernt, doppelte Leerzeilen → reduziert.
 */

import {
  formatDate,
  formatCurrency,
  type TemplateContext,
  type TemplateOption,
} from './emailTemplates';

// --- Zusammengesetzte Variablen (Shared Blocks) ---

/** Gang-Labels (deutsch) */
const COURSE_LABELS: Record<string, string> = {
  starter: 'Antipasto', pasta: 'Pasta', main: 'Hauptgang',
  main_fish: 'Fisch', main_meat: 'Fleisch', dessert: 'Dessert',
  fingerfood: 'Fingerfood', side: 'Beilage', soup: 'Suppe',
};

/** Getränke-Labels (deutsch) */
const DRINK_LABELS: Record<string, string> = {
  aperitif: 'Aperitif', main_drink: 'Weinbegleitung',
  water: 'Wasser', coffee: 'Kaffee', digestif: 'Digestif',
};

/**
 * Dynamischer Eventdetails-Satz aus vorhandenen Werten.
 * Voll: "für Ihre Firmenfeier am Samstag, 15. März 2026 um 19:00 Uhr für 50 Personen im Runden Raum"
 * Minimal: "für Ihre Veranstaltung"
 */
function buildEventDetailsSatz(ctx: TemplateContext): string {
  const parts: string[] = [];
  parts.push(`für Ihre ${ctx.eventart || 'Veranstaltung'}`);
  if (ctx.eventdatum) parts.push(`am ${formatDate(ctx.eventdatum)}`);
  if (ctx.zeitfenster) parts.push(`um ${ctx.zeitfenster} Uhr`);
  if (ctx.gaeste) parts.push(`für ${ctx.gaeste} Personen`);
  if (ctx.raum) parts.push(`im ${ctx.raum}`);
  return parts.join(' ');
}

/** Feste Signatur */
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
 * Checkliste für fehlende Informationen.
 * Bereits bekannte Punkte werden entfernt.
 * Wenn alle Pflicht-Infos da → leerer String.
 */
function buildCheckliste(ctx: TemplateContext): string {
  const missing: string[] = [];
  if (!ctx.eventdatum) missing.push('Gewünschtes Datum und Zeitraum');
  if (!ctx.gaeste) missing.push('Geplante Personenanzahl');
  if (!ctx.eventart) missing.push('Art des Events');
  missing.push('Gewünschtes Catering-Format');
  missing.push('Technischer Bedarf');
  missing.push('Gewünschtes Branding oder besondere Gestaltungselemente');

  return [
    'Für die Ausarbeitung eines konkreten Angebots freuen wir uns über folgende Informationen:',
    '',
    ...missing.map(item => `  • ${item}`),
  ].join('\n');
}

/**
 * Tafelhinweis basierend auf Gästeanzahl.
 * ≤12: "eine lange gemeinsame Tafel"
 * 13–24: "zwei lange Tafeln nebeneinander"
 * >24: "mehrere Tafeln"
 * Kein guest_count → leerer String.
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

  return `Für Ihre Gruppe richten wir ${tafel} her.`;
}

/** Menü der ersten aktiven Option — Speisekarten-Stil */
function formatMenu(options: TemplateOption[]): string {
  const opt = options[0];
  if (!opt || opt.courses.length === 0) return '';
  return opt.courses
    .map(c => {
      const label = c.courseLabel || COURSE_LABELS[c.courseType] || c.courseType;
      return `${label}\n  ${c.itemName}`;
    })
    .join('\n\n');
}

/** Getränke der ersten aktiven Option — Speisekarten-Stil */
function formatDrinks(options: TemplateOption[]): string {
  const opt = options[0];
  if (!opt || opt.drinks.length === 0) return '';
  return opt.drinks
    .map(d => {
      const label = d.drinkLabel || DRINK_LABELS[d.drinkGroup] || d.drinkGroup;
      return `${label}\n  ${d.selectedChoice}`;
    })
    .join('\n\n');
}

/** Alle aktiven Optionen als formatierter Text-Block */
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
    if (opt.courses.length > 0) {
      lines.push('');
      for (const c of opt.courses) {
        const label = c.courseLabel || COURSE_LABELS[c.courseType] || c.courseType;
        lines.push(`  ${label}`);
        lines.push(`  ${c.itemName}`);
        lines.push('');
      }
    }

    // Getränke
    if (opt.drinks.length > 0) {
      lines.push('  Getränkebegleitung');
      for (const d of opt.drinks) {
        const label = d.drinkLabel || DRINK_LABELS[d.drinkGroup] || d.drinkGroup;
        lines.push(`  ${label}: ${d.selectedChoice}`);
      }
      lines.push('');
    }

    // Preis — immer pro Person
    if (opt.totalAmount > 0 && opt.guestCount > 0) {
      lines.push(`  ${formatCurrency(opt.totalAmount / opt.guestCount)} pro Person`);
    }

    return lines.join('\n');
  }).join('\n\n');
}

/** Paketname(n) der aktiven Optionen */
function formatPackageNames(options: TemplateOption[]): string {
  const names = options.map(o => o.packageName).filter(Boolean);
  if (names.length === 0) return '';
  return [...new Set(names)].join(', ');
}

/** Gesamtpreis (erste Option oder Summe) */
function formatTotalPrice(options: TemplateOption[]): string {
  if (options.length === 0) return '';
  if (options.length === 1) {
    return options[0].totalAmount > 0 ? formatCurrency(options[0].totalAmount) : '';
  }
  const total = options.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  return total > 0 ? formatCurrency(total) : '';
}

/** Preis pro Person (erste Option) */
function formatPricePerPerson(options: TemplateOption[]): string {
  const opt = options[0];
  if (!opt || opt.totalAmount <= 0 || opt.guestCount <= 0) return '';
  return formatCurrency(opt.totalAmount / opt.guestCount);
}

// --- Hauptfunktion ---

/**
 * Ersetzt alle {{variablen}} in einem Template-String durch echte Werte.
 *
 * Einfache Variablen: {{kundenname}}, {{firma}}, {{eventdatum}} etc.
 * Zusammengesetzte Variablen: {{eventdetails_satz}}, {{signatur}}, {{checkliste}}, {{tafelhinweis}}
 * Angebot-Variablen: {{paketname}}, {{menu}}, {{getraenke}}, {{gesamtpreis}}, {{preis_pro_person}}, {{optionen}}
 *
 * Cleanup: Nicht ersetzte {{...}} werden entfernt, doppelte Leerzeilen reduziert.
 */
export function renderTemplate(templateBody: string, ctx: TemplateContext): string {
  const options = ctx.options || [];

  // Variablen-Map aufbauen
  const vars: Record<string, string> = {
    // Einfache Variablen (Anfrage-Daten)
    kundenname: ctx.kundenname || 'Damen und Herren',
    firma: ctx.firma || '',
    eventdatum: ctx.eventdatum ? formatDate(ctx.eventdatum) : '',
    gaeste: ctx.gaeste || '',
    eventart: ctx.eventart || 'Veranstaltung',
    raum: ctx.raum || '',
    zeitfenster: ctx.zeitfenster || '',

    // Zusammengesetzte Variablen
    eventdetails_satz: buildEventDetailsSatz(ctx),
    signatur: buildSignatur(),
    checkliste: buildCheckliste(ctx),
    tafelhinweis: buildTafelhinweis(ctx),

    // Angebot-Variablen
    paketname: formatPackageNames(options),
    menu: formatMenu(options),
    getraenke: formatDrinks(options),
    gesamtpreis: formatTotalPrice(options),
    preis_pro_person: formatPricePerPerson(options),
    optionen: renderOptionBlock(options),
  };

  // Alle {{variable}} ersetzen
  let result = templateBody.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? '';
  });

  // Cleanup: Doppelte Leerzeilen → maximal eine
  result = result.replace(/\n{3,}/g, '\n\n');

  // Cleanup: Führende/nachfolgende Leerzeilen
  result = result.trim();

  return result;
}
