import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { MessageSquare, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomerResponse, OfferBuilderOption } from "./types";

interface CustomerFeedbackBannerProps {
  response: CustomerResponse;
  options: OfferBuilderOption[];
  onFinalize?: () => void;
}

export function CustomerFeedbackBanner({
  response,
  options,
  onFinalize,
}: CustomerFeedbackBannerProps) {
  const selectedOption = options.find(o => o.id === response.selectedOptionId);
  const respondedAt = response.respondedAt
    ? format(parseISO(response.respondedAt), "dd. MMMM yyyy 'um' HH:mm", { locale: de })
    : null;

  return (
    <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/50 p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900">
              Kunden-Rückmeldung eingegangen
            </h4>
            {respondedAt && (
              <p className="text-xs text-blue-600">{respondedAt}</p>
            )}
          </div>
        </div>
        {onFinalize && (
          <Button
            onClick={onFinalize}
            size="sm"
            className="rounded-xl gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shrink-0"
          >
            Angebot finalisieren
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {selectedOption && (
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-blue-900">
            Kunde hat <strong>Option {selectedOption.optionLabel}</strong> gewählt
            {selectedOption.packageName && (
              <span className="text-blue-700"> ({selectedOption.packageName})</span>
            )}
          </span>
        </div>
      )}

      {response.customerNotes && (
        <div className="bg-white/60 rounded-xl p-3 border border-blue-100">
          <p className="text-xs font-medium text-blue-600 mb-1">Anmerkung:</p>
          <p className="text-sm text-blue-900 whitespace-pre-wrap">
            {response.customerNotes}
          </p>
        </div>
      )}
    </div>
  );
}
