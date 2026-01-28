import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { QuoteItem, EventInquiry } from "@/types/refine";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { MenuSelection, CourseSelection, DrinkSelection } from "./InquiryEditor/MenuComposer/types";

// Register fonts (using system fonts as fallback)
Font.register({
  family: 'Cormorant',
  fonts: [
    { src: '/fonts/CormorantGaramond-Regular.woff2', fontWeight: 'normal' },
    { src: '/fonts/CormorantGaramond-SemiBold.woff2', fontWeight: 'semibold' },
    { src: '/fonts/CormorantGaramond-Bold.woff2', fontWeight: 'bold' },
  ]
});

// Beige/cream color palette
const colors = {
  cream: '#FDF8F3',
  beige: '#E8DFD4',
  darkBrown: '#3D3229',
  gold: '#B8A07E',
  text: '#2C2419',
  muted: '#6B5D4D',
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.cream,
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottom: `2px solid ${colors.gold}`,
    paddingBottom: 20,
  },
  headerInfo: {
    textAlign: 'right',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.darkBrown,
    marginBottom: 20,
    letterSpacing: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.gold,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 100,
    color: colors.muted,
  },
  value: {
    flex: 1,
    color: colors.text,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.beige,
    padding: 10,
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontWeight: 'bold',
    color: colors.darkBrown,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 10,
    borderBottom: `1px solid ${colors.beige}`,
  },
  colName: {
    flex: 3,
  },
  colQty: {
    width: 60,
    textAlign: 'center',
  },
  colPrice: {
    width: 80,
    textAlign: 'right',
  },
  colTotal: {
    width: 80,
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    borderTop: `2px solid ${colors.gold}`,
    paddingTop: 15,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  totalLabel: {
    width: 150,
    textAlign: 'right',
    marginRight: 20,
    color: colors.muted,
  },
  totalValue: {
    width: 80,
    textAlign: 'right',
  },
  grandTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.darkBrown,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: 'center',
    color: colors.muted,
    fontSize: 8,
    borderTop: `1px solid ${colors.beige}`,
    paddingTop: 15,
  },
  notes: {
    marginTop: 20,
    padding: 15,
    backgroundColor: colors.beige,
    borderRadius: 4,
  },
  notesTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: colors.darkBrown,
  },
  // Menu-specific styles
  menuSection: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#FEFCFA',
    borderRadius: 6,
    borderLeft: `4px solid ${colors.gold}`,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.darkBrown,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  courseRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottom: `1px dotted ${colors.beige}`,
  },
  courseLabel: {
    width: 120,
    fontSize: 9,
    color: colors.gold,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  courseContent: {
    flex: 1,
  },
  courseName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.darkBrown,
    marginBottom: 2,
  },
  courseDescription: {
    fontSize: 9,
    color: colors.muted,
    fontStyle: 'italic',
  },
  drinkSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTop: `1px solid ${colors.beige}`,
  },
  drinkTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.darkBrown,
    marginBottom: 8,
  },
  drinkItem: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
  },
  drinkBullet: {
    width: 12,
    color: colors.gold,
    fontSize: 10,
  },
  drinkText: {
    flex: 1,
    fontSize: 10,
    color: colors.text,
  },
  drinkQuantity: {
    width: 100,
    fontSize: 9,
    color: colors.muted,
    textAlign: 'right',
  },
});

// Course type labels in German
const courseLabels: Record<string, string> = {
  starter: 'Vorspeise',
  pasta: 'Pasta',
  main: 'Hauptgang',
  main_fish: 'Hauptgang (Fisch)',
  main_meat: 'Hauptgang (Fleisch)',
  dessert: 'Dessert',
  fingerfood: 'Fingerfood',
};

// Drink group labels in German
const drinkGroupLabels: Record<string, string> = {
  aperitif: 'Aperitif',
  main_drink: 'Hauptgetränk',
  water: 'Wasser',
  coffee: 'Kaffee',
};

interface QuotePDFProps {
  event: EventInquiry;
  items: QuoteItem[];
  notes: string;
  quoteNumber?: string;
  menuSelection?: MenuSelection | null;
}

// Menu Section Component
const MenuSectionView = ({ menuSelection }: { menuSelection: MenuSelection }) => {
  const hasCourses = menuSelection.courses && menuSelection.courses.length > 0;
  const hasDrinks = menuSelection.drinks && menuSelection.drinks.length > 0;

  if (!hasCourses && !hasDrinks) return null;

  return (
    <View style={styles.menuSection}>
      <Text style={styles.menuTitle}>Ihr Menü</Text>
      
      {/* Courses */}
      {hasCourses && menuSelection.courses.map((course, index) => (
        <View key={index} style={styles.courseRow}>
          <Text style={styles.courseLabel}>
            {course.courseLabel || courseLabels[course.courseType] || course.courseType}
          </Text>
          <View style={styles.courseContent}>
            <Text style={styles.courseName}>{course.itemName}</Text>
            {course.itemDescription && (
              <Text style={styles.courseDescription}>{course.itemDescription}</Text>
            )}
          </View>
        </View>
      ))}
      
      {/* Drinks */}
      {hasDrinks && (
        <View style={styles.drinkSection}>
          <Text style={styles.drinkTitle}>Getränke-Pauschale (pro Person)</Text>
          {menuSelection.drinks.map((drink, index) => (
            <View key={index} style={styles.drinkItem}>
              <Text style={styles.drinkBullet}>•</Text>
              <Text style={styles.drinkText}>
                {drink.drinkLabel || drinkGroupLabels[drink.drinkGroup] || drink.drinkGroup}
                {drink.selectedChoice && `: ${drink.selectedChoice}`}
              </Text>
              {drink.quantityLabel && (
                <Text style={styles.drinkQuantity}>{drink.quantityLabel}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export const QuotePDFDocument = ({ event, items, notes, quoteNumber, menuSelection }: QuotePDFProps) => {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const vat = subtotal * 0.07;
  const total = subtotal + vat;
  const today = format(new Date(), "dd. MMMM yyyy", { locale: de });
  const eventDate = event.preferred_date 
    ? format(new Date(event.preferred_date), "dd. MMMM yyyy", { locale: de })
    : "Nach Vereinbarung";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.darkBrown }}>STORIA</Text>
            <Text style={{ fontSize: 8, color: colors.muted, marginTop: 2 }}>Ristorante Italiano</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text>STORIA München</Text>
            <Text>Schwanthalerstraße 5</Text>
            <Text>80336 München</Text>
            <Text style={{ marginTop: 5 }}>info@storia-muenchen.de</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>ANGEBOT</Text>
        {quoteNumber && (
          <Text style={{ marginBottom: 20, color: colors.muted }}>
            Nr. {quoteNumber} • {today}
          </Text>
        )}

        {/* Client Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kunde</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{event.contact_name}</Text>
          </View>
          {event.company_name && (
            <View style={styles.row}>
              <Text style={styles.label}>Firma:</Text>
              <Text style={styles.value}>{event.company_name}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>E-Mail:</Text>
            <Text style={styles.value}>{event.email}</Text>
          </View>
          {event.phone && (
            <View style={styles.row}>
              <Text style={styles.label}>Telefon:</Text>
              <Text style={styles.value}>{event.phone}</Text>
            </View>
          )}
        </View>

        {/* Event Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event-Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Datum:</Text>
            <Text style={styles.value}>{eventDate}</Text>
          </View>
          {event.guest_count && (
            <View style={styles.row}>
              <Text style={styles.label}>Gäste:</Text>
              <Text style={styles.value}>{event.guest_count} Personen</Text>
            </View>
          )}
          {event.event_type && (
            <View style={styles.row}>
              <Text style={styles.label}>Art:</Text>
              <Text style={styles.value}>{event.event_type}</Text>
            </View>
          )}
        </View>

        {/* Menu Selection (NEW) */}
        {menuSelection && (menuSelection.courses?.length > 0 || menuSelection.drinks?.length > 0) && (
          <MenuSectionView menuSelection={menuSelection} />
        )}

        {/* Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Positionen</Text>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.colName, styles.tableHeaderText]}>Bezeichnung</Text>
              <Text style={[styles.colQty, styles.tableHeaderText]}>Menge</Text>
              <Text style={[styles.colPrice, styles.tableHeaderText]}>Einzelpreis</Text>
              <Text style={[styles.colTotal, styles.tableHeaderText]}>Gesamt</Text>
            </View>
            
            {/* Table Rows */}
            {items.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={styles.colName}>
                  <Text>{item.name}</Text>
                  {item.description && (
                    <Text style={{ fontSize: 8, color: colors.muted, marginTop: 2 }}>
                      {item.description}
                    </Text>
                  )}
                </View>
                <Text style={styles.colQty}>{item.quantity}</Text>
                <Text style={styles.colPrice}>{item.price.toFixed(2)} €</Text>
                <Text style={styles.colTotal}>{(item.price * item.quantity).toFixed(2)} €</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Zwischensumme (netto)</Text>
            <Text style={styles.totalValue}>{subtotal.toFixed(2)} €</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>MwSt. 7%</Text>
            <Text style={styles.totalValue}>{vat.toFixed(2)} €</Text>
          </View>
          <View style={[styles.totalRow, { marginTop: 10 }]}>
            <Text style={[styles.totalLabel, styles.grandTotal]}>Gesamtbetrag</Text>
            <Text style={[styles.totalValue, styles.grandTotal]}>{total.toFixed(2)} €</Text>
          </View>
        </View>

        {/* Notes */}
        {notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Anmerkungen</Text>
            <Text>{notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>STORIA München • Schwanthalerstraße 5 • 80336 München</Text>
          <Text style={{ marginTop: 3 }}>
            Tel: +49 89 51669955 • E-Mail: info@storia-muenchen.de • Web: www.storia-muenchen.de
          </Text>
          <Text style={{ marginTop: 5, fontSize: 7 }}>
            Dieses Angebot ist 14 Tage gültig. Alle Preise verstehen sich inkl. MwSt.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
