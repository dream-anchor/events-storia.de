import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Minus, Plus, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Link = {
  id: string;
  slug: string;
  event_label: string;
  event_label_en: string | null;
  price_per_person_cents: number;
  deposit_paid_cents: number;
  min_guests: number;
  max_guests: number;
  default_guests: number;
  customer_name: string | null;
  event_date: string | null;
};

const eur = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

export default function Restzahlung() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const [link, setLink] = useState<Link | null>(null);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .rpc("get_balance_payment_link_by_slug", { p_slug: slug })
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      setLink(data as Link);
      setGuests(data.default_guests);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (params.get("status") === "cancelled") {
      toast.info("Zahlung abgebrochen — Sie können den Vorgang jederzeit erneut starten.");
    } else if (params.get("status") === "success") {
      toast.success("Vielen Dank! Ihre Zahlung wurde erfasst.");
    }
  }, [params]);

  const calc = useMemo(() => {
    if (!link) return { gross: 0, due: 0 };
    const gross = guests * link.price_per_person_cents;
    const due = Math.max(0, gross - link.deposit_paid_cents);
    return { gross, due };
  }, [link, guests]);

  const handlePay = async () => {
    if (!link) return;
    if (guests < link.min_guests || guests > link.max_guests) {
      toast.error(`Bitte zwischen ${link.min_guests} und ${link.max_guests} Gästen wählen.`);
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-balance-checkout", {
        body: { slug, guests },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Keine Checkout-URL erhalten");
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e?.message || "Fehler beim Starten der Zahlung");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <Card className="max-w-md w-full p-8 text-center rounded-2xl">
          <h1 className="text-xl font-semibold mb-2">Link nicht gefunden</h1>
          <p className="text-sm text-muted-foreground">
            Dieser Restzahlungs-Link ist nicht (mehr) gültig. Bitte kontaktieren Sie uns unter{" "}
            <a className="underline" href="mailto:info@events-storia.de">info@events-storia.de</a>.
          </p>
        </Card>
      </div>
    );
  }

  const clamp = (n: number) => Math.max(link.min_guests, Math.min(link.max_guests, n));

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-sm tracking-widest uppercase text-muted-foreground mb-2">
            Ristorante Storia
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">
            {link.event_label}
          </h1>
          {link.customer_name && (
            <p className="text-sm text-muted-foreground mt-2">{link.customer_name}</p>
          )}
        </div>

        {/* Bilingual hint */}
        <p className="text-xs text-muted-foreground text-right italic mb-4">
          → You'll find the English version below
        </p>

        {/* Main card */}
        <Card className="rounded-2xl p-6 md:p-8 shadow-sm border bg-card">
          <h2 className="text-lg font-semibold mb-1">Restzahlung berechnen</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Bitte geben Sie die finale Gästezahl ein. Der Betrag passt sich automatisch an.
          </p>

          {/* Guest selector */}
          <div className="mb-6">
            <label className="text-sm font-medium block mb-2">Anzahl Gäste</label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setGuests((g) => clamp(g - 1))}
                disabled={guests <= link.min_guests}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                className="text-center text-lg font-semibold w-24"
                value={guests}
                min={link.min_guests}
                max={link.max_guests}
                onChange={(e) => setGuests(clamp(parseInt(e.target.value, 10) || link.min_guests))}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setGuests((g) => clamp(g + 1))}
                disabled={guests >= link.max_guests}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                Min. {link.min_guests}, max. {link.max_guests}
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm mb-6">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {guests} Gäste × {eur(link.price_per_person_cents)}
              </span>
              <span className="font-medium">{eur(calc.gross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">− Bereits gezahlte Anzahlung</span>
              <span className="font-medium">− {eur(link.deposit_paid_cents)}</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between text-base">
              <span className="font-semibold">Jetzt zu zahlen</span>
              <span className="font-bold text-foreground">{eur(calc.due)}</span>
            </div>
          </div>

          <Button
            onClick={handlePay}
            disabled={submitting || calc.due <= 0}
            className="w-full h-12 text-base rounded-xl"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wird vorbereitet…</>
            ) : (
              <>Jetzt sicher bezahlen · {eur(calc.due)}</>
            )}
          </Button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
            <ShieldCheck className="h-3.5 w-3.5" />
            Sichere Zahlung über Stripe · Karte, SEPA, Apple Pay, Google Pay
          </div>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            Die endgültige Gästezahl bestätigen Sie idealerweise 10 Tage vor dem Event.
          </p>
        </Card>

        {/* Divider */}
        <div className="my-12 relative">
          <div className="h-px bg-border" />
          <div className="absolute inset-0 flex justify-center -top-3">
            <span className="bg-background px-4 text-xs tracking-widest uppercase text-muted-foreground">
              English Version
            </span>
          </div>
        </div>

        {/* EN block */}
        <Card className="rounded-2xl p-6 md:p-8 shadow-sm border bg-card">
          <h2 className="text-lg font-semibold mb-1">Calculate balance payment</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Please enter the final guest count above. The amount adjusts automatically.
          </p>
          <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {guests} guests × {eur(link.price_per_person_cents)}
              </span>
              <span className="font-medium">{eur(calc.gross)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">− Deposit already paid</span>
              <span className="font-medium">− {eur(link.deposit_paid_cents)}</span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between text-base">
              <span className="font-semibold">Amount due now</span>
              <span className="font-bold text-foreground">{eur(calc.due)}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Secure payment via Stripe. Please confirm the final guest count 10 days before the event.
          </p>
        </Card>

        <div className="text-center text-xs text-muted-foreground mt-10">
          Fragen? <a className="underline" href="mailto:info@events-storia.de">info@events-storia.de</a>
        </div>
      </div>
    </div>
  );
}