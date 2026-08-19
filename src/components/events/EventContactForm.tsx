import MaestroWidget from "@/components/maestro/MaestroWidget";

const MAESTRO_EVENT_CONTACT_WIDGET_ID = "e2a64978-cdbd-4fe3-b748-cf47c59adf41";

interface EventContactFormProps {
  /** Wird vom MAESTRO-Widget selbst verwaltet — bleibt für Aufrufer-Kompatibilität erhalten. */
  preselectedPackage?: string;
}

/**
 * Event-Kontaktformular — läuft jetzt über das externe MAESTRO-Widget
 * (Shadow DOM, kein iframe). Absenden triggert MAESTRO_INQUIRY_SUBMITTED,
 * das der globale MaestroInquiryBridge abfängt (GA4 + /danke-Redirect).
 */
const EventContactForm = (_props: EventContactFormProps) => {
  return <MaestroWidget widgetId={MAESTRO_EVENT_CONTACT_WIDGET_ID} />;
};

export default EventContactForm;
