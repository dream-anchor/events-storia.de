import { Document, Page, Text, View } from '@react-pdf/renderer';
import { sheetStyles as s } from './styles';
import { SheetHeader, SheetFooter, CustomerBlock, EventBlock, AllergenBlock, locationLabel } from './sheetParts';
import type { PrintInquiry } from '@/lib/print/types';

function MenuSection({ inq }: { inq: PrintInquiry }) {
  const sel = inq.selectedOption;
  if (!sel) {
    return (
      <View style={s.section}>
        <Text style={s.sectionTitle}>Menü</Text>
        <Text>Kein Menü hinterlegt.</Text>
      </View>
    );
  }
  const courses = sel.menuSelection.courses ?? [];
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Menü</Text>
      {courses.length === 0 && <Text>Keine Gänge gewählt.</Text>}
      {courses.map((c, i) => (
        <View key={i} style={s.courseRow} wrap={false}>
          <Text style={s.courseLabel}>{c.courseLabel}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.courseName}>
              {c.quantity && c.quantity > 1 ? `${c.quantity} × ` : ''}{c.itemName}
            </Text>
            {c.itemDescription && <Text style={s.courseDesc}>{c.itemDescription}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

function DrinksSection({ inq }: { inq: PrintInquiry }) {
  const sel = inq.selectedOption;
  if (!sel) return null;
  const drinks = sel.menuSelection.drinks ?? [];
  const einzeln = sel.menuSelection.drinksEinzeln ?? [];
  if (!drinks.length && !einzeln.length && !sel.menuSelection.drinksPauschaleDescription) return null;
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Getränke</Text>
      {drinks.map((d, i) => (
        <View key={i} style={s.row} wrap={false}>
          <Text style={s.label}>{d.drinkLabel}</Text>
          <Text style={s.value}>
            {d.selectedChoice || d.customDrink || '—'}
            {d.quantityLabel ? `  (${d.quantityLabel})` : ''}
          </Text>
        </View>
      ))}
      {einzeln.map((e) => (
        <View key={e.id} style={s.row} wrap={false}>
          <Text style={s.label}>{e.quantity && e.quantity > 1 ? `${e.quantity} ×` : '•'}</Text>
          <Text style={s.value}>{e.name}</Text>
        </View>
      ))}
      {sel.menuSelection.drinksPauschaleDescription && (
        <View style={s.row}>
          <Text style={s.label}>Pauschale</Text>
          <Text style={s.value}>{sel.menuSelection.drinksPauschaleDescription}</Text>
        </View>
      )}
    </View>
  );
}

function NotesSection({ inq }: { inq: PrintInquiry }) {
  if (!inq.internalNotes) return null;
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Sonderwünsche / Notizen</Text>
      <Text>{inq.internalNotes}</Text>
    </View>
  );
}

export function KitchenSheet({ inquiries }: { inquiries: PrintInquiry[] }) {
  return (
    <Document>
      {inquiries.map((inq) => (
        <Page key={inq.id} size="A4" style={s.page}>
          <SheetHeader title="Küchenzettel" inq={inq} />
          <Text style={s.pill}>{locationLabel(inq)}</Text>
          <AllergenBlock inq={inq} />
          <CustomerBlock inq={inq} showContact={false} />
          <EventBlock inq={inq} />
          <MenuSection inq={inq} />
          <DrinksSection inq={inq} />
          <NotesSection inq={inq} />
          <SheetFooter />
        </Page>
      ))}
    </Document>
  );
}