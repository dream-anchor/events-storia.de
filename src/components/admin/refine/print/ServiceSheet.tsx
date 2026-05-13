import { Document, Page, Text, View } from '@react-pdf/renderer';
import { sheetStyles as s } from './styles';
import { SheetHeader, SheetFooter, CustomerBlock, EventBlock, locationLabel } from './sheetParts';
import type { PrintInquiry } from '@/lib/print/types';

function EquipmentSection({ inq }: { inq: PrintInquiry }) {
  const sel = inq.selectedOption;
  const equip = sel?.menuSelection.equipment ?? [];
  const staff = sel?.menuSelection.staff ?? [];
  if (!equip.length && !staff.length) return null;
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Equipment & Personal</Text>
      {equip.map((e) => (
        <View key={e.id} style={s.row} wrap={false}>
          <Text style={s.label}>{e.quantity} ×</Text>
          <Text style={s.value}>{e.name}</Text>
        </View>
      ))}
      {staff.map((p) => (
        <View key={p.id} style={s.row} wrap={false}>
          <Text style={s.label}>{p.quantity} ×</Text>
          <Text style={s.value}>{p.name} (Personal)</Text>
        </View>
      ))}
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

export function ServiceSheet({ inquiries }: { inquiries: PrintInquiry[] }) {
  return (
    <Document>
      {inquiries.map((inq) => (
        <Page key={inq.id} size="A4" style={s.page}>
          <SheetHeader title="Service-Laufzettel" inq={inq} />
          <Text style={s.pill}>{locationLabel(inq)}</Text>
          <CustomerBlock inq={inq} showContact={true} />
          <EventBlock inq={inq} />
          <EquipmentSection inq={inq} />
          <NotesSection inq={inq} />
          <SheetFooter />
        </Page>
      ))}
    </Document>
  );
}