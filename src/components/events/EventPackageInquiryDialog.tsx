import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import MaestroWidget, { MAESTRO_WIDGET_ENABLED } from "@/components/maestro/MaestroWidget";
import EventPackageInquiryDialogNative from "./EventPackageInquiryDialogNative";

const MAESTRO_PACKAGE_INQUIRY_WIDGET_ID = "bf736453-8d35-46b3-9ef7-f6b7cb36da5a";

interface EventPackageInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: string;
  packageName: string;
  packageNameEn?: string | null;
  initialGuestCount: number;
  pricePerPerson: number;
  isPricePerPerson?: boolean;
  minGuests?: number;
}

/**
 * Paket-Anfrage — läuft jetzt über das externe MAESTRO-Widget
 * (Shadow DOM, kein iframe). Absenden triggert MAESTRO_INQUIRY_SUBMITTED,
 * das der globale MaestroInquiryBridge abfängt (GA4 + /danke-Redirect).
 */
const EventPackageInquiryDialog = (props: EventPackageInquiryDialogProps) => {
  const { open, onOpenChange, packageName, packageNameEn } = props;
  const { language } = useLanguage();
  const [widgetFailed, setWidgetFailed] = useState(false);
  const displayName = language === "en" && packageNameEn ? packageNameEn : packageName;

  if (!MAESTRO_WIDGET_ENABLED || widgetFailed) {
    return <EventPackageInquiryDialogNative {...props} />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {language === "de" ? "Angebot anfragen" : "Request a quote"}
          </DialogTitle>
          <DialogDescription>{displayName}</DialogDescription>
        </DialogHeader>
        {open && (
          <MaestroWidget
            widgetId={MAESTRO_PACKAGE_INQUIRY_WIDGET_ID}
            onUnavailable={() => setWidgetFailed(true)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventPackageInquiryDialog;
