// Erzeugt ein einfaches, gut lesbares PDF für einen STORIA-Gutschein.
// Verwendet pdf-lib (läuft in Deno). Eingebettete Helvetica reicht völlig –
// kein Custom-Font, kein Web-Asset-Fetch nötig.
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

export interface VoucherPdfInput {
  code: string;
  amountEuros: number;
  validUntilDate: Date;
  recipientName?: string | null;
  purchaserName?: string | null;
  message?: string | null;
}

function formatDateDE(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatDateEN(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function formatEuro(n: number): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

/** Bricht Text grob auf maxWidth (Heuristik, ausreichend für die Nachricht). */
function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line ? line + " " : "") + w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 6); // Cap defensiv
}

export async function buildVoucherPdf(input: VoucherPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const fg = rgb(0.07, 0.07, 0.07);
  const muted = rgb(0.4, 0.4, 0.4);
  const accent = rgb(0.55, 0.12, 0.12); // Storia-rot

  // Header
  page.drawText("STORIA", {
    x: 50, y: height - 70, size: 28, font: fontBold, color: accent,
  });
  page.drawText("Ristorante · Maxvorstadt München", {
    x: 50, y: height - 90, size: 11, font: fontRegular, color: muted,
  });

  // Trennlinie
  page.drawLine({
    start: { x: 50, y: height - 110 }, end: { x: width - 50, y: height - 110 },
    thickness: 0.5, color: muted,
  });

  // Titel
  page.drawText("GUTSCHEIN", {
    x: 50, y: height - 160, size: 36, font: fontBold, color: fg,
  });
  page.drawText("Voucher", {
    x: 50, y: height - 185, size: 14, font: fontItalic, color: muted,
  });

  // Betrag (Box)
  const boxY = height - 320;
  page.drawRectangle({
    x: 50, y: boxY, width: width - 100, height: 100,
    borderColor: accent, borderWidth: 1.5,
  });
  page.drawText("Wert / Value", {
    x: 70, y: boxY + 70, size: 11, font: fontRegular, color: muted,
  });
  page.drawText(formatEuro(input.amountEuros), {
    x: 70, y: boxY + 30, size: 42, font: fontBold, color: accent,
  });

  // Code
  let y = boxY - 50;
  page.drawText("Gutscheincode / Voucher code", {
    x: 50, y, size: 11, font: fontRegular, color: muted,
  });
  y -= 28;
  page.drawText(input.code, {
    x: 50, y, size: 24, font: fontBold, color: fg,
  });

  // Empfänger / Absender
  y -= 50;
  if (input.recipientName) {
    page.drawText("Für / For:", { x: 50, y, size: 11, font: fontRegular, color: muted });
    page.drawText(input.recipientName, { x: 120, y, size: 12, font: fontBold, color: fg });
    y -= 20;
  }
  if (input.purchaserName) {
    page.drawText("Von / From:", { x: 50, y, size: 11, font: fontRegular, color: muted });
    page.drawText(input.purchaserName, { x: 120, y, size: 12, font: fontBold, color: fg });
    y -= 20;
  }

  // Nachricht
  if (input.message && input.message.trim()) {
    y -= 15;
    page.drawText("Persönliche Nachricht / Personal message:", {
      x: 50, y, size: 11, font: fontRegular, color: muted,
    });
    y -= 20;
    for (const line of wrap(input.message.trim(), 80)) {
      page.drawText(line, { x: 50, y, size: 12, font: fontItalic, color: fg });
      y -= 16;
    }
  }

  // Gültigkeit
  const validDE = formatDateDE(input.validUntilDate);
  const validEN = formatDateEN(input.validUntilDate);
  page.drawText(`Gültig bis ${validDE}  ·  Valid until ${validEN}`, {
    x: 50, y: 140, size: 11, font: fontRegular, color: muted,
  });

  // Einlöse-Hinweis
  page.drawText("Einlösung vor Ort im STORIA München.", {
    x: 50, y: 110, size: 10, font: fontRegular, color: muted,
  });
  page.drawText("Redeemable in person at STORIA Munich.", {
    x: 50, y: 96, size: 10, font: fontRegular, color: muted,
  });

  // Footer
  page.drawText("STORIA · Karlstraße 47a · 80333 München · +49 163 6033912 · info@events-storia.de", {
    x: 50, y: 50, size: 9, font: fontRegular, color: muted,
  });

  return await doc.save();
}

/** Generiert einen kollisionsarmen Code im Format STORIA-XXXX-XXXX (Großbuchstaben/Ziffern, ohne 0/O/1/I). */
export function generateVoucherCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `STORIA-${block()}-${block()}`;
}