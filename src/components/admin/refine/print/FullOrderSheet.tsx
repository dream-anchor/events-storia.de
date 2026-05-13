import { Document, Page, Text, View } from '@react-pdf/renderer';
import { sheetStyles as s } from './styles';
import { SheetHeader, SheetFooter, CustomerBlock, EventBlock, locationLabel, fmtMoney } from './sheetParts';
import type { PrintInquiry } from '@/lib/print/types';

function MenuPriced({ inq }: { inq: PrintInquiry }) {
  const sel = inq.selectedOption;
  if (!sel) return null;
  const courses = sel.menuSelection.courses ?? [];
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Menü</Text>
      {courses.map((c, i) => (
        <View key={i} style={s.courseRow} wrap={false}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <Text style={s.courseLabel}>{c.courseLabel}</Text>
            <Text style={s.courseName}>{c.itemName}</Text>
          </View>
          <Text style={s.qtyCol}>{c.quantity ?? 1}</Text>
          <Text style={s.priceCol}>{c.overridePrice != null ? fmtMoney(c.overridePrice) : '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function EquipmentPriced({ inq }: { inq: PrintInquiry }) {
  const sel = inq.selectedOption;
  const equip = sel?.menuSelection.equipment ?? [];
  const staff = sel?.menuSelection.staff ?? [];
  if (!equip.length && !staff.length) return null;
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Equipment & Personal</Text>
      {[...equip, ...staff].map((e) => (
        <View key={e.id} style={s.courseRow} wrap={false}>
          <Text style={{ flex: 1 }}>{e.name}</Text>
          <Text style={s.qtyCol}>{e.quantity}</Text>
          <Text style={s.priceCol}>{fmtMoney(e.pricePerUnit * e.quantity)}</Text>
        </View>
      ))}
    </View>
  );
}

function PaymentBlock({ inq }: { inq: PrintInquiry }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>Zahlung</Text>
      <View style={s.row}>
        <Text style={s.label}>Methode</Text>
        <Text style={s.value}>{inq.paymentMethod || '—'}</Text>
      </View>
      {inq.depositAmount != null && (
        <View style={s.row}>
          <Text style={s.label}>Anzahlung</Text>
          <Text style={s.value}>{fmtMoney(inq.depositAmount)}</Text>
        </View>
      )}
      <View style={s.row}>
        <Text style={s.label}>Bezahlt</Text>
        <Text style={s.value}>{fmtMoney(inq.paidAmount)}</Text>
      </View>
      <View style={s.row}>
        <Text style={s.label}>Offen</Text>
        <Text style={s.value}>{fmtMoney(inq.remainingAmount)}</Text>
      </View>
      {inq.lexofficeInvoiceId && (
        <View style={s.row}>
          <Text style={s.label}>LexOffice</Text>
          <Text style={s.value}>{inq.lexofficeInvoiceId}</Text>
        </View>
      )}
    </View>
  );
}

export function FullOrderSheet({ inquiries }: { inquiries: PrintInquiry[] }) {
  return (
    <Document>
      {inquiries.map((inq) => (
        <Page key={inq.id} size="A4" style={s.page}>
          <SheetHeader title="Komplettauftrag" inq={inq} />
          <Text style={s.pill}>{locationLabel(inq)} · Status: {inq.status} · v{inq.currentVersion}</Text>
          <CustomerBlock inq={inq} showContact={true} />
          <EventBlock inq={inq} />
          <MenuPriced inq={inq} />
          <EquipmentPriced inq={inq} />
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Gesamt (brutto)</Text>
            <Text style={s.totalValue}>{fmtMoney(inq.totalAmount)}</Text>
          </View>
          <PaymentBlock inq={inq} />
          {inq.internalNotes && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Interne Notizen</Text>
              <Text>{inq.internalNotes}</Text>
            </View>
          )}
          <SheetFooter />
        </Page>
      ))}
    </Document>
  );
}