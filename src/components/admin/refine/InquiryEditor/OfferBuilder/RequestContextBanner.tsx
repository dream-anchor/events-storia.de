import { useState } from "react";
import { Inbox, Package as PackageIcon, MessageSquare, Tag, ChevronDown, ChevronUp, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { parseInquirySource } from "@/lib/inquirySource";
import type { ExtendedInquiry, Package } from "./types";

interface RequestContextBannerProps {
  inquiry: ExtendedInquiry;
  packages: Package[];
  /**
   * Wird mit der aufgelösten Package-ID aufgerufen, wenn der Betreiber das
   * angefragte Paket direkt in Option A übernehmen will. Wenn undefined,
   * wird kein „Übernehmen"-Button gezeigt.
   */
  onApplyPackageToOptionA?: (packageId: string, packageName: string) => void;
  /** Sperrt den „Übernehmen"-Button (z. B. nach unterschriebener Kostenübernahme). */
  disabled?: boolean;
  /** Optional: Triggert KI-Menüvorschlag, der in die nächste freie Option (A–E) geschrieben wird. */
  onGenerateMenuSuggestion?: () => void | Promise<void>;
  /** True während die KI generiert — sperrt den Button und zeigt Loader. */
  isGeneratingSuggestion?: boolean;
}

const MESSAGE_TEASER_LENGTH = 180;

export function RequestContextBanner({
  inquiry,
  packages,
  onApplyPackageToOptionA,
  disabled = false,
  onGenerateMenuSuggestion,
  isGeneratingSuggestion = false,
}: RequestContextBannerProps) {
  const [messageExpanded, setMessageExpanded] = useState(false);

  const parsed = parseInquirySource(inquiry.source);

  // Paket-Auflösung: erst aus source (package_inquiry_<id>), sonst aus selected_packages[0]
  const packageFromSource = parsed.packageIdFromSource
    ? packages.find((p) => p.id === parsed.packageIdFromSource) ?? null
    : null;
  const selectedPkg =
    Array.isArray(inquiry.selected_packages) && inquiry.selected_packages.length > 0
      ? inquiry.selected_packages[0]
      : null;
  const packageFromSelected = selectedPkg
    ? packages.find((p) => p.id === selectedPkg.id) ?? null
    : null;

  const requestedPackage = packageFromSource ?? packageFromSelected;
  const requestedPackageName =
    requestedPackage?.name ?? selectedPkg?.name ?? null;
  const requestedPackageId = requestedPackage?.id ?? selectedPkg?.id ?? null;

  const message = (inquiry.message ?? "").trim();
  const hasLongMessage = message.length > MESSAGE_TEASER_LENGTH;
  const messagePreview = hasLongMessage
    ? `${message.slice(0, MESSAGE_TEASER_LENGTH).trimEnd()}…`
    : message;

  const hasAnyContext =
    Boolean(parsed.raw) ||
    Boolean(requestedPackageName) ||
    Boolean(inquiry.event_type) ||
    message.length > 0;

  if (!hasAnyContext) return null;

  const showApplyButton =
    !disabled &&
    !inquiry.offer_sent_at &&
    Boolean(requestedPackageId) &&
    Boolean(onApplyPackageToOptionA);

  const showSuggestButton = !disabled && Boolean(onGenerateMenuSuggestion);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-neutral-800">
        <Inbox className="h-4 w-4 text-neutral-500" />
        Was hat der Kunde angefragt?
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-xs uppercase tracking-wider text-neutral-500 self-center">
          Quelle
        </dt>
        <dd className="text-neutral-800">{parsed.label}</dd>

        {requestedPackageName && (
          <>
            <dt className="text-xs uppercase tracking-wider text-neutral-500 self-center">
              Paket
            </dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-neutral-200 px-2 py-1 text-sm font-medium text-neutral-800">
                <PackageIcon className="h-3.5 w-3.5 text-neutral-500" />
                {requestedPackageName}
              </span>
              {showApplyButton && requestedPackageId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-lg text-xs"
                  onClick={() =>
                    onApplyPackageToOptionA?.(
                      requestedPackageId,
                      requestedPackageName,
                    )
                  }
                >
                  Als Option A übernehmen
                </Button>
              )}
            </dd>
          </>
        )}

        {inquiry.event_type && (
          <>
            <dt className="text-xs uppercase tracking-wider text-neutral-500 self-center">
              Anlass
            </dt>
            <dd>
              <Badge variant="secondary" className="font-normal">
                <Tag className="mr-1 h-3 w-3" />
                {inquiry.event_type}
              </Badge>
            </dd>
          </>
        )}
      </dl>

      <div className="pt-2 border-t border-neutral-200/70">
        <div className="flex items-start gap-2">
          <MessageSquare className="h-4 w-4 text-neutral-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            {message.length > 0 ? (
              <>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-neutral-700">
                  {messageExpanded ? message : messagePreview}
                </p>
                {hasLongMessage && (
                  <button
                    type="button"
                    onClick={() => setMessageExpanded((v) => !v)}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
                  >
                    {messageExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Weniger
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Mehr anzeigen
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm italic text-neutral-500">
                Keine Nachricht — Anfrage direkt aus Funnel/Dialog ohne Freitext.
              </p>
            )}
          </div>
        </div>
      </div>

      {showSuggestButton && (
        <div className="pt-3 border-t border-neutral-200/70 flex items-center justify-between gap-3">
          <p className="text-xs text-neutral-500 leading-snug">
            Die KI liest Anlass, Nachricht, Tonfall und Ortsbezug — und legt
            <strong className="font-medium text-neutral-700"> 3 Varianten</strong> (Low · Medium · High) in die nächsten freien Optionen.
          </p>
          <Button
            type="button"
            variant="secondaryElevated"
            size="sm"
            className="shrink-0 h-9 rounded-xl text-xs"
            disabled={isGeneratingSuggestion}
            onClick={() => onGenerateMenuSuggestion?.()}
          >
            {isGeneratingSuggestion ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                KI denkt nach…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                3 Menü-Varianten mit KI
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}