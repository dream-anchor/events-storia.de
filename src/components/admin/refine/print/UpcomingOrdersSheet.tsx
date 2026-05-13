import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { sheetStyles, printColors } from './styles';
import type { InquiryRecord } from '@/types/inquiryRecord';

export type GroupBy = 'week' | 'month';
export type LocationScope = 'both' | 'inhouse' | 'offsite';

interface Props {
  records: InquiryRecord[];
  groupBy: GroupBy;
  scope: LocationScope;
  rangeLabel: string;
  generatedBy?: string;
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4,
    paddingBottom: 3,
    borderBottom: `1px solid ${printColors.text}`,
  },
  scopeTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 6,
    marginBottom: 3,
    color: printColors.muted,
  },
  itemRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottom: `0.5px solid ${printColors.line}`,
  },
  cDate: { width: 70, fontSize: 9 },
  cTime: { width: 38, fontSize: 9, color: printColors.muted },
  cCustomer: { flex: 1.6, fontSize: 9, fontWeight: 'bold', paddingRight: 6 },
  cGuests: { width: 38, fontSize: 9, textAlign: 'right' },
  cWhere: { flex: 1.8, fontSize: 9, color: printColors.muted, paddingLeft: 6 },
  cStatus: { width: 60, fontSize: 8, textAlign: 'right', color: printColors.muted },
  groupSummary: {
    fontSize: 8,
    color: printColors.muted,
    marginTop: 3,
    marginBottom: 4,
    textAlign: 'right',
  },
  empty: { fontSize: 9, color: printColors.muted, fontStyle: 'italic', paddingVertical: 4 },
});

function whereLabel(r: InquiryRecord): string {
  // We don't have address details on InquiryRecord; use occasion/number fallback
  const raw: any = r.raw;
  if (r.serviceType === 'restaurant') {
    return raw?.occasion || 'Karlstr. 47a';
  }
  // Außer Haus / Catering
  return raw?.occasion || raw?.delivery_city || raw?.delivery_address || '—';
}

function statusLabel(r: InquiryRecord): string {
  if (r.offerPhase === 'paid') return 'bezahlt';
  if (r.offerPhase === 'booked' || r.status === 'confirmed') return 'gebucht';
  if (r.offerPhase === 'offer_chosen') return 'gewählt';
  if (r.offerPhase === 'offer_sent') return 'Angebot';
  return r.status || '—';
}

function getGroupKey(date: Date, mode: GroupBy): string {
  if (mode === 'week') {
    // ISO week
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function groupLabel(key: string, mode: GroupBy, sample: Date): string {
  if (mode === 'week') {
    // Compute Mon-Sun range
    const day = sample.getDay() || 7;
    const monday = new Date(sample);
    monday.setDate(sample.getDate() - (day - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const week = key.split('-W')[1];
    return `KW ${week} · ${format(monday, 'dd.MM.', { locale: de })}–${format(sunday, 'dd.MM.yyyy', { locale: de })}`;
  }
  return format(sample, 'MMMM yyyy', { locale: de });
}

function isInHouse(r: InquiryRecord): boolean {
  return r.serviceType === 'restaurant';
}

export function UpcomingOrdersSheet({ records, groupBy, scope, rangeLabel, generatedBy }: Props) {
  // Filter by scope
  const scoped = records.filter((r) => {
    if (scope === 'inhouse') return isInHouse(r);
    if (scope === 'offsite') return !isInHouse(r);
    return true;
  });

  // Group
  const groupsMap = new Map<string, { sample: Date; items: InquiryRecord[] }>();
  for (const r of scoped) {
    if (!r.date) continue;
    const d = parseISO(r.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = getGroupKey(d, groupBy);
    if (!groupsMap.has(key)) groupsMap.set(key, { sample: d, items: [] });
    groupsMap.get(key)!.items.push(r);
  }
  const groups = Array.from(groupsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      label: groupLabel(key, groupBy, v.sample),
      items: v.items.sort((a, b) => {
        const da = a.date ? parseISO(a.date).getTime() : 0;
        const db = b.date ? parseISO(b.date).getTime() : 0;
        if (da !== db) return da - db;
        return (a.time || '').localeCompare(b.time || '');
      }),
    }));

  const today = format(new Date(), 'dd.MM.yyyy HH:mm', { locale: de });

  return (
    <Document>
      <Page size="A4" style={sheetStyles.page}>
        <View style={sheetStyles.header} fixed>
          <View>
            <Text style={sheetStyles.brand}>EVENTS STORIA</Text>
            <Text style={sheetStyles.brandSub}>Karlstr. 47a · 80333 München</Text>
          </View>
          <View>
            <Text style={sheetStyles.docTitle}>Nächste Aufträge</Text>
            <Text style={sheetStyles.docMeta}>
              {rangeLabel} · {scope === 'both' ? 'In Haus & Außer Haus' : scope === 'inhouse' ? 'In Haus' : 'Außer Haus'}
            </Text>
            <Text style={sheetStyles.docMeta}>
              Druck: {today}{generatedBy ? ` · ${generatedBy}` : ''}
            </Text>
          </View>
        </View>

        {groups.length === 0 ? (
          <Text style={styles.empty}>Keine Aufträge im gewählten Zeitraum.</Text>
        ) : (
          groups.map((g) => {
            const inhouse = g.items.filter(isInHouse);
            const offsite = g.items.filter((x) => !isInHouse(x));
            const totalGuests = g.items.reduce((sum, x) => sum + (x.guestCount || 0), 0);
            return (
              <View key={g.key} wrap={false}>
                <Text style={styles.groupTitle}>{g.label}</Text>
                <Text style={styles.groupSummary}>
                  ∑ {g.items.length} Aufträge · {totalGuests} Gäste
                </Text>

                {(scope === 'both' || scope === 'inhouse') && inhouse.length > 0 && (
                  <View>
                    <Text style={styles.scopeTitle}>In Haus ({inhouse.length})</Text>
                    {inhouse.map((r) => (
                      <ItemRow key={`${r.kind}-${r.id}`} r={r} />
                    ))}
                  </View>
                )}
                {(scope === 'both' || scope === 'offsite') && offsite.length > 0 && (
                  <View>
                    <Text style={styles.scopeTitle}>Außer Haus ({offsite.length})</Text>
                    {offsite.map((r) => (
                      <ItemRow key={`${r.kind}-${r.id}`} r={r} />
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={sheetStyles.footer} fixed>
          <Text>Events Storia · interner Druck</Text>
          <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function ItemRow({ r }: { r: InquiryRecord }) {
  const d = r.date ? parseISO(r.date) : null;
  return (
    <View style={styles.itemRow}>
      <Text style={styles.cDate}>
        {d ? format(d, 'EE dd.MM.', { locale: de }) : '—'}
      </Text>
      <Text style={styles.cTime}>{r.time || ''}</Text>
      <Text style={styles.cCustomer}>
        {r.companyName || r.customerName}
      </Text>
      <Text style={styles.cGuests}>
        {r.guestCount ? `${r.guestCount} P` : '—'}
      </Text>
      <Text style={styles.cWhere}>{whereLabel(r)}</Text>
      <Text style={styles.cStatus}>{statusLabel(r)}</Text>
    </View>
  );
}