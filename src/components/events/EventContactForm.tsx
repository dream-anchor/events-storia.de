import { useState } from "react";
import MaestroWidget, { MAESTRO_WIDGET_ENABLED, isMaestroUnavailable } from "@/components/maestro/MaestroWidget";
import EventContactFormNative from "./EventContactFormNative";

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
const EventContactForm = (props: EventContactFormProps) => {
  const [widgetFailed, setWidgetFailed] = useState(() => isMaestroUnavailable());

  if (!MAESTRO_WIDGET_ENABLED || widgetFailed) {
    return <EventContactFormNative {...props} />;
  }

  return (
    <MaestroWidget
      widgetId={MAESTRO_EVENT_CONTACT_WIDGET_ID}
      onUnavailable={() => setWidgetFailed(true)}
    />
  );
};

export default EventContactForm;
