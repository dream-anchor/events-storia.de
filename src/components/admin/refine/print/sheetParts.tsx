import { Text, View } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { sheetStyles as s, printColors } from './styles';
import type { PrintInquiry } from '@/lib/print/types';

export function fmtDate(d: string | null): string {
  if (!d) return '—';
  try {
    return format(new Date(d), 'EEEE, d. MMMM yyyy', { locale: de });
  } catch {
    return d;
  }
}

export function fmtTime(t: string | null): string {
  if (!t) return '—';
  return t;
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

export function locationLabel(inq: PrintInquiry): string {
  if (inq.locationType === 'storia') return 'IM HAUS';
  return 'AUSSER HAUS';
}

export function SheetHeader({ title, inq }: { title: string; inq: PrintInquiry }) {
  return (
    <View style={s.header} fixed>
      <View>
        <Text style={s.brand}>STORIA EVENTS</Text>
        <Text style={s.brandSub}>events-storia.de · Karlstr. 47a · 80333 München</Text>
      </View>
      <View>
        <Text style={s.docTitle}>{title}</Text>
        <Text style={s.docMeta}>Auftrag #{inq.orderNumber}</Text>
        <Text style={s.docMeta}>v{inq.currentVersion} · gedruckt {format(new Date(), 'dd.MM.yyyy HH:mm')}</Text>
      </View>
    </View>
  );
}

export function SheetFooter() {
  return (
    <View style={s.footer} fixed>
      <Text>events-storia.de · interner Druck</Text>
      <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export function CustomerBlock({ inq, showContact = true }: { inq: PrintInquiry; showContact?: boolean }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Kunde</Text>
      <View style={s.row}>
        <Text style={s.label}>Name</Text>
        <Text style={s.value}>{inq.contactName}</Text>
      </View>
      {inq.companyName && (
        <View style={s.row}>
          <Text style={s.label}>Firma</Text>
          <Text style={s.value}>{inq.companyName}</Text>
        </View>
      )}
      {showContact && (
        <>
          <View style={s.row}>
            <Text style={s.label}>E-Mail</Text>
            <Text style={s.value}>{inq.email}</Text>
          </View>
          {inq.phone && (
            <View style={s.row}>
              <Text style={s.label}>Telefon</Text>
              <Text style={s.value}>{inq.phone}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export function EventBlock({ inq }: { inq: PrintInquiry }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Event</Text>
      <View style={s.row}>
        <Text style={s.label}>Datum</Text>
        <Text style={s.value}>{fmtDate(inq.preferredDate)}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Uhrzeit</Text>
        <Text style={s.value}>{fmtTime(inq.timeSlot)}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Gäste</Text>
        <Text style={s.value}>{inq.guestCount} Personen</Text>
      </View>
      {inq.eventType && (
        <View style={s.row}>
          <Text style={s.label}>Anlass</Text>
          <Text style={s.value}>{inq.eventType}</Text>
        </View>
      )}
      <View style={s.row}>
        <Text style={s.label}>Ort</Text>
        <Text style={s.value}>{inq.locationAddress || '—'}</Text>
      </View>
      {inq.roomSelection && (
        <View style={s.row}>
          <Text style={s.label}>Raum</Text>
          <Text style={s.value}>{inq.roomSelection}</Text>
        </View>
      )}
    </View>
  );
}

export function AllergenBlock({ inq }: { inq: PrintInquiry }) {
  if (!inq.allergens) return null;
  return (
    <View style={s.alertBox}>
      <Text style={s.alertTitle}>⚠ Allergene / Unverträglichkeiten</Text>
      <Text>{inq.allergens}</Text>
    </View>
  );
}

export { s as printStyles, printColors };