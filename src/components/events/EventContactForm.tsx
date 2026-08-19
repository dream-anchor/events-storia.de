import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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
 *
 * Der Widget-Container wird in eine zentrierte Karte (max-w-2xl) gepackt,
 * damit das responsive Widget nicht die volle Desktop-Breite ausfüllt —
 * analog zum nativen Formular.
 */
const EventContactForm = (props: EventContactFormProps) => {
  const { language } = useLanguage();
  const [widgetFailed, setWidgetFailed] = useState(() => isMaestroUnavailable());

  if (!MAESTRO_WIDGET_ENABLED || widgetFailed) {
    return <EventContactFormNative {...props} />;
  }

  return (
    <section id="kontaktformular" className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-serif font-medium mb-4">
              {language === 'de' ? 'Jetzt unverbindlich anfragen' : 'Request a Quote'}
            </h2>
            <p className="text-muted-foreground">
              {language === 'de'
                ? 'Füllen Sie das Formular aus und wir melden uns innerhalb von 24 Stunden mit einem individuellen Angebot.'
                : 'Fill out the form and we will get back to you within 24 hours with a customized offer.'}
            </p>
          </div>

          <div className="bg-card border border-border/50 rounded-2xl shadow-sm p-6 md:p-8">
            <MaestroWidget
              widgetId={MAESTRO_EVENT_CONTACT_WIDGET_ID}
              onUnavailable={() => setWidgetFailed(true)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default EventContactForm;
