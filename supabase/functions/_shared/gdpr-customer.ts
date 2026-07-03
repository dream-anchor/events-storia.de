/**
 * Shared GDPR/DSGVO helper — sammelt den vollständigen Datengraphen zu einem
 * Kunden (v2_customers.id) für zwei Zwecke:
 *
 *  1. Auskunft/Export (Art. 15/20 DSGVO)  → export-customer-data
 *  2. Löschung/Anonymisierung (Art. 17)   → delete-customer-data
 *
 * WICHTIG: Dieses Modul führt selbst KEINE Schreiboperationen aus. Es liest
 * nur. Schreiboperationen (Anonymisieren/Löschen) passieren ausschließlich
 * in delete-customer-data/index.ts, nach expliziter Freigabe (siehe dort).
 *
 * Buchhaltungspflichtige Daten (Rechnungen, Zahlungen — HGB/AO) werden hier
 * markiert (isEventAccountingRelevant), damit die aufrufende Function für
 * diese Datensätze ANONYMISIEREN statt hart löschen kann.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface CustomerRow {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  address_street: string | null;
  address_zip: string | null;
  address_city: string | null;
  lexoffice_contact_id: string | null;
  auth_user_id: string | null;
  merged_into_id: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: string;
  customer_id: string;
  number: string | null;
  status: string;
  invoice_lexoffice_id: string | null;
  lexoffice_quotation_id: string | null;
  [key: string]: unknown;
}

export interface GdprCustomerGraph {
  /** Alle Kunden-Datensätze, die zur selben natürlichen Person gehören
   *  (der angefragte Datensatz + evtl. per merge_into hierher zusammengeführte Duplikate). */
  customers: CustomerRow[];
  primaryCustomer: CustomerRow;
  events: EventRow[];
  eventIds: string[];
  /** event_id -> ist der Event buchhaltungsrelevant (Rechnung/Zahlung/Kostenübernahme)? */
  accountingRelevantEventIds: Set<string>;
  offerOptions: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  changelog: Record<string, unknown>[];
  comments: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  offerHistory: Record<string, unknown>[];
  eventEmails: Record<string, unknown>[];
  costAcceptances: Record<string, unknown>[];
  balancePaymentLinks: Record<string, unknown>[];
  reviewRequestLog: Record<string, unknown>[];
  emailDeliveryLogs: Record<string, unknown>[];
  eventEmailLinks: Record<string, unknown>[];
  inboxEmails: Record<string, unknown>[];
  inquiryAttachments: Record<string, unknown>[];
  aiConversations: Record<string, unknown>[];
  aiMessages: Record<string, unknown>[];
  aiExtractions: Record<string, unknown>[];
  customerProfile: Record<string, unknown> | null;
  vouchers: Record<string, unknown>[];
  /** Nur informativ — wird NIE verändert (Suppression-Liste, s. Kommentar in delete-customer-data). */
  reviewUnsubscribe: Record<string, unknown> | null;
  /** Nur informativ — eigenes Audit-Log, wird NIE verändert/gelöscht. */
  activityLogs: Record<string, unknown>[];
}

async function fetchIn(
  admin: SupabaseClient,
  table: string,
  column: string,
  values: string[],
  select = "*",
): Promise<Record<string, unknown>[]> {
  if (values.length === 0) return [];
  const { data, error } = await admin.from(table).select(select).in(
    column,
    values,
  );
  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Ermittelt alle v2_customers-Zeilen derselben natürlichen Person: den
 * angefragten Datensatz sowie ALLE über `merged_into_id` verbundenen
 * Duplikate — in BEIDE Richtungen:
 *   - Abwärts: Duplikate, die in den angefragten Datensatz zusammengeführt
 *     wurden (merged_into_id → diese Zeile).
 *   - Aufwärts: falls der angefragte Datensatz selbst bereits in einen
 *     ANDEREN (kanonischen) Datensatz zusammengeführt wurde, wird dieser
 *     Ziel-Datensatz (und dessen eigene Duplikate) ebenfalls einbezogen.
 * Ohne die Aufwärts-Suche würde eine Löschanfrage für einen bereits
 * zusammengeführten (stub-)Datensatz nur den leeren Stub treffen — die
 * eigentlichen, aktiven Daten der Person unter der kanonischen ID blieben
 * unangetastet. Das Feld wird heute von keinem Feature aktiv gesetzt, ist
 * aber für eine künftige Merge-Funktion vorgesehen — daher hier bereits
 * korrekt (bidirektional) behandelt.
 * Breitensuche in beide Richtungen, bis kein neuer Datensatz mehr gefunden wird.
 */
async function resolveCustomerFamily(
  admin: SupabaseClient,
  customerId: string,
): Promise<CustomerRow[]> {
  const { data: root, error } = await admin
    .from("v2_customers")
    .select("*")
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw error;
  if (!root) return [];

  const family = new Map<string, CustomerRow>();
  family.set(root.id, root as CustomerRow);
  let frontier: CustomerRow[] = [root as CustomerRow];

  while (frontier.length > 0) {
    const frontierIds = frontier.map((c) => c.id);
    const ancestorIds = frontier
      .map((c) => c.merged_into_id)
      .filter((id): id is string => !!id && !family.has(id));

    const queries: Promise<{ data: CustomerRow[] | null; error: unknown }>[] = [
      admin.from("v2_customers").select("*").in("merged_into_id", frontierIds)
        .then((r) => ({ data: r.data as CustomerRow[] | null, error: r.error })),
    ];
    if (ancestorIds.length > 0) {
      queries.push(
        admin.from("v2_customers").select("*").in("id", ancestorIds)
          .then((r) => ({ data: r.data as CustomerRow[] | null, error: r.error })),
      );
    }

    const results = await Promise.all(queries);
    const next: CustomerRow[] = [];
    for (const res of results) {
      if (res.error) throw res.error;
      for (const c of res.data ?? []) {
        if (!family.has(c.id)) {
          family.set(c.id, c);
          next.push(c);
        }
      }
    }
    frontier = next;
  }

  return Array.from(family.values());
}

export function isEventAccountingRelevant(
  event: EventRow,
  payments: Record<string, unknown>[],
  costAcceptances: Record<string, unknown>[],
): boolean {
  if (event.invoice_lexoffice_id || event.lexoffice_quotation_id) return true;
  const hasPayment = payments.some((p) => p.event_id === event.id);
  if (hasPayment) return true;
  const hasSignedAcceptance = costAcceptances.some(
    (c) => c.inquiry_id === event.id && c.status === "signed",
  );
  if (hasSignedAcceptance) return true;
  return false;
}

/** Sammelt den vollständigen (Lese-)Datengraphen für eine Kunden-ID. */
export async function loadGdprCustomerGraph(
  admin: SupabaseClient,
  customerId: string,
): Promise<GdprCustomerGraph | null> {
  const customers = await resolveCustomerFamily(admin, customerId);
  const primaryCustomer = customers.find((c) => c.id === customerId);
  if (!primaryCustomer) return null;

  const customerIds = customers.map((c) => c.id);
  const emails = Array.from(
    new Set(
      customers
        .map((c) => (c.email ?? "").trim().toLowerCase())
        .filter((e) => e.length > 0),
    ),
  );

  const events = (await fetchIn(
    admin,
    "v2_events",
    "customer_id",
    customerIds,
  )) as EventRow[];
  const eventIds = events.map((e) => e.id);

  const [
    offerOptions,
    payments,
    changelog,
    comments,
    tasks,
    offerHistory,
    eventEmails,
    costAcceptances,
    reviewRequestLog,
    emailDeliveryLogsByEvent,
    eventEmailLinks,
    inquiryAttachments,
    aiConversationsByInquiry,
  ] = await Promise.all([
    fetchIn(admin, "v2_offer_options", "event_id", eventIds),
    fetchIn(admin, "v2_payments", "event_id", eventIds),
    fetchIn(admin, "v2_event_changelog", "event_id", eventIds),
    fetchIn(admin, "v2_event_comments", "event_id", eventIds),
    fetchIn(admin, "v2_event_tasks", "event_id", eventIds),
    fetchIn(admin, "v2_event_offer_history", "event_id", eventIds),
    fetchIn(admin, "v2_event_emails", "event_id", eventIds),
    fetchIn(admin, "cost_acceptances", "inquiry_id", eventIds),
    fetchIn(admin, "review_request_log", "event_id", eventIds),
    fetchIn(admin, "email_delivery_logs", "entity_id", eventIds),
    fetchIn(admin, "event_email_links", "event_id", eventIds),
    fetchIn(admin, "inquiry_attachments", "inquiry_id", eventIds),
    fetchIn(admin, "ai_conversations", "inquiry_id", eventIds),
  ]);

  // ai_conversations können auch ohne inquiry_id existieren (früher Chat-Kontakt,
  // noch keine Anfrage angelegt) — dort ist customer_email die einzige Verknüpfung.
  const aiConversationsByEmail = emails.length > 0
    ? await fetchIn(admin, "ai_conversations", "customer_email", emails)
    : [];
  const aiConvMap = new Map<string, Record<string, unknown>>();
  for (const c of [...aiConversationsByInquiry, ...aiConversationsByEmail]) {
    aiConvMap.set(c.id as string, c);
  }
  const aiConversations = Array.from(aiConvMap.values());
  const conversationIds = aiConversations.map((c) => c.id as string);

  const [aiMessages, aiExtractions] = await Promise.all([
    fetchIn(admin, "ai_messages", "conversation_id", conversationIds),
    fetchIn(admin, "ai_extractions", "conversation_id", conversationIds),
  ]);

  const emailIds = Array.from(
    new Set(eventEmailLinks.map((l) => l.email_id as string)),
  );
  const inboxEmails = await fetchIn(admin, "inbox_emails", "id", emailIds);

  // balance_payment_links hat keine FK auf v2_events; Verknüpfung über event_id
  // (falls gesetzt) UND/ODER customer_email (Pflichtfeld auf dieser Tabelle).
  const balanceByEvent = await fetchIn(
    admin,
    "balance_payment_links",
    "event_id",
    eventIds,
  );
  const balanceByEmail = emails.length > 0
    ? await fetchIn(admin, "balance_payment_links", "customer_email", emails)
    : [];
  const balanceMap = new Map<string, Record<string, unknown>>();
  for (const b of [...balanceByEvent, ...balanceByEmail]) {
    balanceMap.set(b.id as string, b);
  }
  const balancePaymentLinks = Array.from(balanceMap.values());

  // vouchers sind ausschließlich per E-Mail verknüpft (Gutschein-Käufer/-Empfänger).
  const vouchersByPurchaser = emails.length > 0
    ? await fetchIn(admin, "vouchers", "purchaser_email", emails)
    : [];
  const vouchersByRecipient = emails.length > 0
    ? await fetchIn(admin, "vouchers", "recipient_email", emails)
    : [];
  const voucherMap = new Map<string, Record<string, unknown>>();
  for (const v of [...vouchersByPurchaser, ...vouchersByRecipient]) {
    voucherMap.set(v.id as string, v);
  }
  const vouchers = Array.from(voucherMap.values());

  // Nur informativ: Unsubscribe-Liste ist eine Suppression-Liste (email = PK).
  // Sie wird NIE angefasst — siehe ausführlicher Kommentar in delete-customer-data.
  let reviewUnsubscribe: Record<string, unknown> | null = null;
  if (primaryCustomer.email) {
    const { data } = await admin
      .from("review_request_unsubscribes")
      .select("*")
      .eq("email", primaryCustomer.email.trim().toLowerCase())
      .maybeSingle();
    reviewUnsubscribe = data ?? null;
  }

  // Nur informativ: eigenes Audit-Log (activity_logs), bleibt unverändert.
  const activityLogs = await fetchIn(
    admin,
    "activity_logs",
    "entity_id",
    eventIds,
  );

  let customerProfile: Record<string, unknown> | null = null;
  const authUserIds = customers
    .map((c) => c.auth_user_id)
    .filter((id): id is string => !!id);
  if (authUserIds.length > 0) {
    const { data } = await admin
      .from("customer_profiles")
      .select("*")
      .in("user_id", authUserIds)
      .maybeSingle();
    customerProfile = data ?? null;
  }

  const accountingRelevantEventIds = new Set(
    events
      .filter((e) => isEventAccountingRelevant(e, payments, costAcceptances))
      .map((e) => e.id),
  );

  return {
    customers,
    primaryCustomer,
    events,
    eventIds,
    accountingRelevantEventIds,
    offerOptions,
    payments,
    changelog,
    comments,
    tasks,
    offerHistory,
    eventEmails,
    costAcceptances,
    balancePaymentLinks,
    reviewRequestLog,
    emailDeliveryLogs: emailDeliveryLogsByEvent,
    eventEmailLinks,
    inboxEmails,
    inquiryAttachments,
    aiConversations,
    aiMessages,
    aiExtractions,
    customerProfile,
    vouchers,
    reviewUnsubscribe,
    activityLogs,
  };
}

/** Kompaktes Mengengerüst je Kategorie — für Vorschau/Audit ohne vollen Datenexport. */
export function summarizeGraph(graph: GdprCustomerGraph) {
  return {
    customers: graph.customers.length,
    events: graph.events.length,
    accounting_relevant_events: graph.accountingRelevantEventIds.size,
    offer_options: graph.offerOptions.length,
    payments: graph.payments.length,
    event_changelog: graph.changelog.length,
    event_comments: graph.comments.length,
    event_tasks: graph.tasks.length,
    offer_history: graph.offerHistory.length,
    event_emails: graph.eventEmails.length,
    cost_acceptances: graph.costAcceptances.length,
    balance_payment_links: graph.balancePaymentLinks.length,
    review_request_log: graph.reviewRequestLog.length,
    email_delivery_logs: graph.emailDeliveryLogs.length,
    event_email_links: graph.eventEmailLinks.length,
    inbox_emails: graph.inboxEmails.length,
    inquiry_attachments: graph.inquiryAttachments.length,
    ai_conversations: graph.aiConversations.length,
    ai_messages: graph.aiMessages.length,
    ai_extractions: graph.aiExtractions.length,
    has_customer_profile: !!graph.customerProfile,
    vouchers: graph.vouchers.length,
    has_review_unsubscribe_entry: !!graph.reviewUnsubscribe,
    activity_log_entries: graph.activityLogs.length,
  };
}
