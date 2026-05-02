import { useEffect, useState } from "react";
import { useParams, useLocation, useSearchParams } from "react-router-dom";
import { LocalizedLink } from "@/components/LocalizedLink";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import type { OfferPhase, PublicInquiry, PublicOfferOption, PublicOfferData, PublicPayment, MenuSelection } from "./public-offer/types";
import { OfferHeader, OfferFooter } from "./public-offer/OfferHeader";
import { HeroSection } from "./public-offer/HeroSection";
import { AnschreibenSection } from "./public-offer/AnschreibenSection";
import { PdfDownloadGate } from "./public-offer/PdfDownloadSection";
import { ProposalView } from "./public-offer/ProposalView";
import { ThankYouView } from "./public-offer/ThankYouView";
import { FinalOfferView } from "./public-offer/FinalOfferView";
import { ConfirmationView } from "./public-offer/ConfirmationView";
import { PublicPaymentSection } from "./public-offer/PaymentSection";
import { ContactSection } from "./public-offer/ContactSection";

export default function PublicOffer() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<PublicOfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [payments, setPayments] = useState<PublicPayment[]>([]);

  // Preview-Modus
  const previewBodyRaw = searchParams.get('preview_body');
  let previewBody: string | null = null;
  if (previewBodyRaw) {
    try {
      previewBody = decodeURIComponent(previewBodyRaw);
    } catch {
      previewBody = null;
    }
  }

  const previewSend = searchParams.get('preview_send');
  const isPreviewMode = previewBody !== null || previewSend !== null;

  // Archiv-Modus
  const archiveVersionRaw = searchParams.get('archive_version');
  const archiveVersionNum = archiveVersionRaw ? parseInt(archiveVersionRaw, 10) : null;
  const [archiveAuthorized, setArchiveAuthorized] = useState<boolean | null>(
    archiveVersionNum != null ? null : false,
  );
  const [archiveSentAt, setArchiveSentAt] = useState<string | null>(null);

  useEffect(() => {
    if (archiveVersionNum == null) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { setArchiveAuthorized(false); return; }
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'staff'])
        .maybeSingle();
      if (!cancelled) setArchiveAuthorized(!!roleRow);
    })();
    return () => { cancelled = true; };
  }, [archiveVersionNum]);

  const isArchiveMode = archiveVersionNum != null && archiveAuthorized === true;
  const isSlugRoute = location.pathname.includes('/ihr-angebot/') || location.pathname.includes('/your-offer/');
  const lookupValue = slug || id;

  // Stripe-Cancel / Success handling
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'cancelled') {
      toast.info('Zahlung abgebrochen — Ihre Auswahl wurde gespeichert.', { duration: 5000 });
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('payment');
        window.history.replaceState({}, '', url.toString());
      } catch { /* ignore */ }
    }
    if (paymentStatus === 'success') {
      toast.success('Zahlung erfolgreich — Ihre Buchung wird bestätigt.', { duration: 8000 });
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('payment');
        window.history.replaceState({}, '', url.toString());
      } catch { /* ignore */ }
      if (lookupValue) {
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          if (attempts > 15) { clearInterval(pollInterval); return; }
          try {
            const rpcName = slug ? 'get_public_offer_by_slug' : 'get_public_offer';
            const rpcArg = slug ? { slug: lookupValue } : { offer_id: lookupValue };
            const { data: fresh } = await supabase.rpc(rpcName as never, rpcArg as never);
            const parsed = fresh as { inquiry?: { offer_phase?: string } } | null;
            if (parsed?.inquiry?.offer_phase === 'confirmed' || parsed?.inquiry?.offer_phase === 'paid') {
              clearInterval(pollInterval);
              setData({
                inquiry: parsed.inquiry as PublicInquiry,
                options: (parsed as unknown as PublicOfferData).options,
                customer_response: (parsed as unknown as PublicOfferData).customer_response,
              });
            }
          } catch { /* ignore polling errors */ }
        }, 2000) as unknown as ReturnType<typeof setTimeout>;
        return () => clearInterval(pollInterval);
      }
    }
  }, [searchParams]);

  // Fetch offer data
  useEffect(() => {
    if (!lookupValue) return;
    if (archiveVersionNum != null && archiveAuthorized === null) return;

    const fetchOffer = async () => {
      try {
        if (isArchiveMode && id) {
          const { data: hist, error: histErr } = await supabase
            .from('inquiry_offer_history' as never)
            .select('options_snapshot, email_content, sent_at')
            .eq('inquiry_id', id)
            .eq('version', archiveVersionNum!)
            .maybeSingle();
          if (histErr || !hist) {
            setError(true); setLoading(false); return;
          }
          setArchiveSentAt(((hist as { sent_at?: string | null }).sent_at) ?? null);
          const { data: live } = await supabase.rpc('get_public_offer' as never, { offer_id: id } as never);
          const liveData = live as unknown as PublicOfferData | null;
          const snapshotOpts = ((hist as { options_snapshot: unknown[] }).options_snapshot || [])
            .filter((o: unknown) => {
              const oo = o as { is_active?: boolean; isActive?: boolean };
              return oo.is_active !== false && oo.isActive !== false;
            })
            .map((o: unknown) => {
              const oo = o as Record<string, unknown>;
              return {
                id: String(oo.id ?? ''),
                option_label: String(oo.option_label ?? oo.optionLabel ?? ''),
                offer_mode: String(oo.offer_mode ?? oo.offerMode ?? 'menu'),
                guest_count: Number(oo.guest_count ?? oo.guestCount ?? 0),
                menu_selection: (oo.menu_selection ?? oo.menuSelection ?? null) as MenuSelection | null,
                total_amount: Number(oo.total_amount ?? oo.totalAmount ?? 0),
                stripe_payment_link_url: null,
                package_name:
                  (oo.menu_selection as { packageNameOverride?: string } | null)?.packageNameOverride ||
                  `Option ${oo.option_label ?? ''}`,
                sort_order: Number(oo.sort_order ?? 0),
                selected_quantity: (oo.selected_quantity ?? null) as number | null,
              } as PublicOfferOption;
            });
          setData({
            inquiry: (liveData?.inquiry as PublicInquiry) || ({
              id, company_name: null, contact_name: '', email: null, event_type: null,
              preferred_date: null, event_end_date: null, guest_count: null,
              status: 'archived', offer_phase: 'proposal_sent', selected_option_id: null,
              email_content: (hist as { email_content: string | null }).email_content,
              lexoffice_invoice_id: null,
            } as PublicInquiry),
            options: snapshotOpts,
            customer_response: null,
          });
          setLoading(false);
          return;
        }

        let result;
        let rpcError;
        if (isSlugRoute) {
          const res = await supabase.rpc("get_public_offer_by_slug" as never, { slug: lookupValue } as never);
          result = res.data; rpcError = res.error;
        } else {
          const res = await supabase.rpc("get_public_offer" as never, { offer_id: lookupValue } as never);
          result = res.data; rpcError = res.error;
        }
        if (rpcError || !result || !(result as PublicOfferData).inquiry) {
          setError(true);
        } else {
          setData(result as unknown as PublicOfferData);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchOffer();
  }, [lookupValue, isSlugRoute, isArchiveMode, archiveVersionNum, archiveAuthorized, id]);

  // Load payments
  useEffect(() => {
    if (!data?.inquiry?.id) return;
    supabase
      .from("event_payments")
      .select("id, payment_type, amount_cents, status, due_date, due_days_before_event, paid_at, paid_via, stripe_payment_link_url")
      .eq("inquiry_id", data.inquiry.id)
      .not("status", "in", "(cancelled,refunded,draft)")
      .order("created_at", { ascending: true })
      .then(({ data: rows }) => {
        if (rows?.length) setPayments(rows as PublicPayment[]);
      });
  }, [data?.inquiry?.id]);

  // --- Render ---

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-sans">Angebot wird geladen…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <OfferHeader />
        <div className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-serif font-bold mb-4">Angebot nicht gefunden</h1>
          <p className="text-muted-foreground mb-8 font-sans">
            Dieses Angebot ist nicht verfügbar oder wurde noch nicht versendet.
          </p>
          <LocalizedLink to="home" className="text-primary hover:underline font-medium font-sans">
            Zur Startseite
          </LocalizedLink>
        </div>
        <OfferFooter />
      </div>
    );
  }

  const { inquiry, options, customer_response } = data;
  const phase = inquiry.offer_phase || "draft";

  const effectivePhase: OfferPhase = isPreviewMode
    ? (previewSend === 'final' ? 'final_sent' : 'proposal_sent')
    : (phase === "draft" && inquiry.status === "offer_sent" ? "final_sent" : phase);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <OfferHeader />
      {isArchiveMode && (
        <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 border-b border-amber-700/40 shadow-sm">
          <div className="container mx-auto px-4 py-2.5 text-sm font-sans flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
            <span className="font-semibold uppercase tracking-wide text-xs">Archiv-Ansicht</span>
            <span>·</span>
            <span>
              Version v{archiveVersionNum}
              {archiveSentAt && (
                <> — versendet am{' '}
                  {(() => {
                    try {
                      return new Date(archiveSentAt).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      });
                    } catch { return archiveSentAt; }
                  })()}
                </>
              )}
            </span>
            <span>·</span>
            <span className="opacity-90">Interaktive Aktionen sind deaktiviert.</span>
          </div>
        </div>
      )}
      <main className="flex-1">
        <HeroSection inquiry={inquiry} phase={effectivePhase} />

        {inquiry.lexoffice_invoice_id && (
          <PdfDownloadGate
            inquiryId={inquiry.id}
            options={options}
            phase={isPreviewMode ? ((inquiry.offer_phase as OfferPhase) || 'draft') : effectivePhase}
            isArchiveMode={isArchiveMode}
            isPreviewMode={isPreviewMode}
          />
        )}

        {(previewBody || inquiry.email_content) && (
          <AnschreibenSection emailContent={previewBody || inquiry.email_content || ''} />
        )}

        {(effectivePhase === "proposal_sent" || previewBody !== null) && (
          <div
            id="proposal-view"
            className={isArchiveMode ? "pointer-events-none opacity-70 select-none" : ""}
            aria-disabled={isArchiveMode || undefined}
          >
            <ProposalView
              inquiry={inquiry}
              options={options}
              onSubmitted={(updatedData) => setData(updatedData)}
              isArchiveMode={isArchiveMode}
              isPreviewMode={isPreviewMode}
            />
          </div>
        )}

        {effectivePhase === "customer_responded" && (
          <ThankYouView customerResponse={customer_response} options={options} />
        )}

        {(effectivePhase === "final_sent" || effectivePhase === "final_draft") && (
          <div
            className={isArchiveMode ? "pointer-events-none opacity-70 select-none" : ""}
            aria-disabled={isArchiveMode || undefined}
          >
            <FinalOfferView inquiry={inquiry} options={options} />
          </div>
        )}

        {(effectivePhase === "confirmed" || effectivePhase === "paid") && (
          <ConfirmationView inquiry={inquiry} options={options} />
        )}

        <div
          className={isArchiveMode ? "pointer-events-none opacity-70 select-none" : ""}
          aria-disabled={isArchiveMode || undefined}
        >
          <PublicPaymentSection payments={payments} eventDate={inquiry.preferred_date ?? undefined} />
        </div>
        <ContactSection />
      </main>
      <OfferFooter />
    </div>
  );
}
