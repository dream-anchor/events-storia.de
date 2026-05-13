import { useState } from "react";
import { Download, Lock, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { PublicOfferOption, OfferPhase } from "./types";
import { isCustomerSelectionComplete } from "./types";

function PdfDownloadButton({ inquiryId }: { inquiryId: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        'download-public-offer-pdf',
        { body: { inquiryId } }
      );

      if (error || !data?.pdf) {
        throw new Error(data?.error || 'PDF nicht verfügbar');
      }

      const blob = new Blob(
        [Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))],
        { type: 'application/pdf' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'STORIA_Angebot.pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2.5 min-h-[44px] py-2.5 px-5 rounded-xl border border-neutral-300 bg-white text-neutral-900 font-medium text-sm hover:bg-neutral-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            Angebot als PDF herunterladen
          </button>
        </div>
      </div>
    </section>
  );
}

export function PdfDownloadGate({
  inquiryId,
  options,
  phase,
  isArchiveMode,
  isPreviewMode,
}: {
  inquiryId: string;
  options: PublicOfferOption[];
  phase: OfferPhase;
  isArchiveMode: boolean;
  isPreviewMode?: boolean;
}) {
  if (isArchiveMode) {
    return <PdfDownloadButton inquiryId={inquiryId} />;
  }

  if (isCustomerSelectionComplete(options, phase)) {
    return <PdfDownloadButton inquiryId={inquiryId} />;
  }

  const handleScrollToSelection = () => {
    document.getElementById('proposal-view')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <section className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-100">
              <Lock className="h-5 w-5 text-neutral-600" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-neutral-900">
                Angebots-PDF nach Auswahl verfügbar
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                Bitte wähle zuerst deine bevorzugte Option unten aus. Sobald du deine
                Auswahl bestätigst, steht hier dein persönliches Angebots-PDF zum
                Download bereit.
              </p>
              {isPreviewMode && (
                <p className="mt-2 text-xs italic text-neutral-500">
                  Vorschau-Hinweis: Auch in der Live-Ansicht wird der Download erst freigegeben, sobald der Kunde seine Auswahl bestätigt.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleScrollToSelection}
                className="mt-4 min-h-[44px] gap-2"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                Zur Auswahl
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}