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
    alignItems: 'stretch',
    paddingVertical: 5,
    borderBottom: `0.5px solid ${printColors.line}`,
  },
  cDateBlock: { width: 78 },
  cDate: { fontSize: 10, fontWeight: 'bold' },
  cTime: { fontSize: 9, color: printColors.muted, marginTop: 1 },
  cGuestsBox: {
    width: 44,
    marginRight: 8,
    border: `0.8px solid ${printColors.text}`,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cGuestsNum: { fontSize: 12, fontWeight: 'bold' },
  cGuestsLabel: { fontSize: 7, color: printColors.muted, letterSpacing: 0.5, marginTop: 1 },
  cBody: { flex: 1, paddingRight: 6 },
  cBodyTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cCustomer: { fontSize: 10, fontWeight: 'bold' },
  cMeta: { fontSize: 8, color: printColors.muted, textAlign: 'right' },
  cDescription: { fontSize: 8, color: printColors.muted, marginTop: 2 },
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
  if (r.roomOrCityShort) return r.roomOrCityShort;
  const raw: any = r.raw;
  if (r.serviceType === 'restaurant') return raw?.venue || 'Karlstr. 47a';
  return raw?.delivery_city || raw?.delivery_address || raw?.occasion || '—';
}

function descriptionLine(r: InquiryRecord): string {
  const parts: string[] = [];
  if (r.occasion) parts.push(r.occasion);
  if (r.packageLabel) parts.push(r.packageLabel);
  else if (r.menuSummary) parts.push(r.menuSummary);
  const where = whereLabel(r);
  if (where && where !== '—') parts.push(where);
  return parts.join(' · ') || '—';
}

function dateLabel(r: InquiryRecord): string {
  if (!r.date) return '—';
  const d = parseISO(r.date);
  if (Number.isNaN(d.getTime())) return '—';
  if (r.dateEnd && r.dateEnd !== r.date) {
    const e = parseISO(r.dateEnd);
    if (!Number.isNaN(e.getTime())) {
      return `${format(d, 'EE dd.MM.', { locale: de })}–${format(e, 'EE dd.MM.', { locale: de })}`;
    }
  }
  return format(d, 'EE dd.MM.', { locale: de });
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
  const meta: string[] = [];
  if (r.assignedInitials) meta.push(r.assignedInitials);
  meta.push(statusLabel(r));
  return (
    <View style={styles.itemRow} wrap={false}>
      <View style={styles.cDateBlock}>
        <Text style={styles.cDate}>{dateLabel(r)}</Text>
        <Text style={styles.cTime}>{r.time || '—'}</Text>
      </View>
      <View style={styles.cGuestsBox}>
        <Text style={styles.cGuestsNum}>{r.guestCount ?? '—'}</Text>
        <Text style={styles.cGuestsLabel}>PERS</Text>
      </View>
      <View style={styles.cBody}>
        <View style={styles.cBodyTop}>
          <Text style={styles.cCustomer}>
            {r.companyName || r.customerName}
          </Text>
          <Text style={styles.cMeta}>{meta.join(' · ')}</Text>
        </View>
        <Text style={styles.cDescription}>{descriptionLine(r)}</Text>
      </View>
    </View>
  );
}