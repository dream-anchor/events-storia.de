import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Gift, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TurnstileWidget } from "@/components/gift/TurnstileWidget";
import { turnstileEnabled } from "@/lib/gift/turnstile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { GiftBasketCard } from "@/components/gift/GiftBasketCard";
import { useGiftCart } from "@/hooks/useGiftCart";
import { trackEvent } from "@/lib/analytics";
import { getLocalizedPath } from "@/config/routes";
import { GIFT_COPY } from "@/lib/gift/copy";
import {
  createGiftOrder,
  fetchGiftCatalog,
  fetchGiftSettings,
  GiftApiError,
  quoteDelivery,
} from "@/lib/gift/api";
import { parseDeepLink, resolveDeepLink, type DeepLinkNote } from "@/lib/gift/deeplink";
import {
  addDays,
  berlinParts,
  checkSchedule,
  earliestDate,
  formatEuro,
  isBlackout,
  MAX_QTY_PER_LINE,
  pickupSlots,
  type Handover,
  type ScheduleSettings,
} from "@/lib/gift/pricing";
import type { GiftBasket, GiftPublicSettings } from "@/lib/gift/types";
import { GIFT_LEGAL_APPROVED } from "../../supabase/functions/_shared/giftLegal";

const FORM_KEY = "storia-gift-form";

interface FormState {
  handover: Handover;
  date: string;
  time: string;
  street: string;
  zip: string;
  city: string;
  note: string;
  name: string;
  email: string;
  phone: string;
  giftMessage: string;
  paymentMethod: "online" | "on_site";
}

const EMPTY_FORM: FormState = {
  handover: "pickup", date: "", time: "", street: "", zip: "", city: "", note: "",
  name: "", email: "", phone: "", giftMessage: "", paymentMethod: "online",
};

function loadForm(): FormState {
  try {
    const raw = sessionStorage.getItem(FORM_KEY);
    return raw ? { ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<FormState>) } : EMPTY_FORM;
  } catch {
    return EMPTY_FORM;
  }
}

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; feeCents: number; km: number }
  | { status: "error"; code: string };

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const GiftOrder = () => {
  const { language } = useLanguage();
  const lang = language === "de" ? "de" : "en";
  const t = GIFT_COPY[lang];
  const prefix = lang === "en" ? "/en" : "";
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [catalog, setCatalog] = useState<GiftBasket[] | null>(null);
  const [settings, setSettings] = useState<GiftPublicSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const { lines, add, setQty, replace, clear } = useGiftCart();
  const [form, setForm] = useState<FormState>(loadForm);
  const [quote, setQuote] = useState<QuoteState>({ status: "idle" });
  const [ageOk, setAgeOk] = useState(false);
  const [agbOk, setAgbOk] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deepNotes, setDeepNotes] = useState<DeepLinkNote[]>([]);
  const [now, setNow] = useState(() => new Date());
  const deepLinkApplied = useRef(false);
  const quoteSeq = useRef(0);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // ?lang=en (z. B. aus den IT/FR-Seiten) -> EN-Shop
  useEffect(() => {
    if (params.get("lang") === "en" && language === "de") {
      const next = new URLSearchParams(params);
      next.delete("lang");
      const qs = next.toString();
      navigate(`/en/geschenkkoerbe/bestellung${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }, [params, language, navigate]);

  // Uhr tickt minütlich, damit "heute noch" und Slots aktuell bleiben
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([fetchGiftCatalog(), fetchGiftSettings()]);
      setCatalog(c);
      setSettings(s);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);
  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  // Entwurf der Eingaben (ohne Zustimmungen) für Rückkehr von Stripe
  useEffect(() => {
    try { sessionStorage.setItem(FORM_KEY, JSON.stringify(form)); } catch { /* ignorieren */ }
  }, [form]);

  // Deep-Link einmal anwenden (Preise/Bestand stammen aus dem Katalog, nicht aus der URL)
  useEffect(() => {
    if (!catalog || deepLinkApplied.current) return;
    deepLinkApplied.current = true;
    const positions = parseDeepLink(params);
    if (positions.length === 0) return;
    const { lines: resolved, notes } = resolveDeepLink(positions, catalog, MAX_QTY_PER_LINE);
    if (resolved.length > 0) replace(resolved);
    setDeepNotes(notes);
    trackEvent("view_item", { location: "geschenkkorb_deeplink", items: resolved.length });
  }, [catalog, params, replace]);

  const variantIndex = useMemo(() => {
    const m = new Map<string, { basket: GiftBasket; variant: GiftBasket["variants"][number] }>();
    for (const b of catalog ?? []) for (const v of b.variants) m.set(v.id, { basket: b, variant: v });
    return m;
  }, [catalog]);

  // Zeilen mit nicht (mehr) existierenden Varianten verwerfen
  const cartLines = useMemo(
    () => lines.flatMap((l) => {
      const hit = variantIndex.get(l.variantId);
      return hit ? [{ ...l, ...hit }] : [];
    }),
    [lines, variantIndex],
  );
  useEffect(() => {
    if (catalog && cartLines.length !== lines.length) replace(cartLines.map((l) => ({ variantId: l.variantId, qty: l.qty })));
  }, [catalog, cartLines, lines.length, replace]);

  const sched: ScheduleSettings | null = useMemo(
    () => settings && {
      pickup_hours: settings.pickup_hours,
      pickup_lead_minutes: settings.pickup_lead_minutes,
      delivery_lead_days: settings.delivery_lead_days,
      delivery_windows: settings.delivery_windows,
    },
    [settings],
  );

  const firstDate = useCallback((handover: Handover): string => {
    if (!sched || !settings) return "";
    const start = earliestDate(handover, now, sched);
    for (let i = 0; i < 90; i++) {
      const d = addDays(start, i);
      if (handover === "pickup" ? pickupSlots(d, now, sched, settings.blackout_dates).length > 0 : !isBlackout(d, "delivery", settings.blackout_dates)) return d;
    }
    return start;
  }, [sched, settings, now]);

  // Termin vorbelegen: Abholung = heute ab sofort (bei Vorrat), Lieferung = frühestens Folgetag
  useEffect(() => {
    if (!sched || !settings) return;
    setForm((f) => {
      const check = f.date && f.time ? checkSchedule(f.handover, f.date, f.time, now, sched, settings.blackout_dates) : { ok: false };
      if (check.ok) return f;
      const date = f.date && f.date >= earliestDate(f.handover, now, sched) && !isBlackout(f.date, f.handover, settings.blackout_dates) ? f.date : firstDate(f.handover);
      const time = f.handover === "pickup" ? pickupSlots(date, now, sched, settings.blackout_dates)[0] ?? "" : sched.delivery_windows[0]?.key ?? "";
      return date === f.date && time === f.time ? f : { ...f, date, time };
    });
  }, [sched, settings, now, form.handover, form.date, firstDate]);

  const slots = useMemo(
    () => (sched && settings && form.handover === "pickup" && form.date ? pickupSlots(form.date, now, sched, settings.blackout_dates) : []),
    [sched, settings, form.handover, form.date, now],
  );

  // Live-Quote: Adresse vollständig -> sofort voraussichtlicher Lieferpreis
  useEffect(() => {
    if (form.handover !== "delivery") { setQuote({ status: "idle" }); return; }
    const street = form.street.trim(), zip = form.zip.trim(), city = form.city.trim();
    if (street.length < 3 || !/\d/.test(street) || !/^\d{5}$/.test(zip) || city.length < 2) { setQuote({ status: "idle" }); return; }
    const seq = ++quoteSeq.current;
    setQuote({ status: "loading" });
    const timer = setTimeout(async () => {
      try {
        const q = await quoteDelivery({ street, zip, city });
        if (seq === quoteSeq.current) setQuote({ status: "ok", feeCents: q.estimated_fee_cents, km: q.distance_km });
      } catch (e) {
        if (seq === quoteSeq.current) setQuote({ status: "error", code: e instanceof GiftApiError ? e.code : "routing_unavailable" });
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [form.handover, form.street, form.zip, form.city]);

  // Zahlung vor Ort nur bei Abholung
  useEffect(() => {
    if (form.handover === "delivery" && form.paymentMethod === "on_site") set("paymentMethod", "online");
  }, [form.handover, form.paymentMethod]);

  const itemsTotal = cartLines.reduce((s, l) => s + l.basket.price_cents * l.qty, 0);
  const deliveryFee = form.handover === "delivery" && quote.status === "ok" ? quote.feeCents : 0;
  const total = itemsTotal + deliveryFee;
  const anyLmivIncomplete = cartLines.some((l) => !l.variant.lmiv_complete || l.basket.components.some((c) => !c.lmiv_complete));

  const showDeepNote = (n: DeepLinkNote): string => {
    switch (n.kind) {
      case "unknown_basket": return t.noteUnknownBasket;
      case "unknown_wine": return t.noteUnknownWine;
      case "sold_out": return t.noteSoldOut;
      case "capped": return t.noteCapped(n.qty);
    }
  };

  const validate = (): string | null => {
    if (cartLines.length === 0) return t.valCart;
    if (cartLines.some((l) => l.variant.available < l.qty)) return t.err.sold_out;
    if (!sched || !settings || !checkSchedule(form.handover, form.date, form.time, now, sched, settings.blackout_dates).ok) return t.valSchedule;
    if (form.handover === "delivery") {
      if (form.street.trim().length < 3 || !/^\d{5}$/.test(form.zip.trim()) || form.city.trim().length < 2) return t.valAddress;
      if (form.phone.trim().length < 5) return t.valPhone;
      if (quote.status !== "ok") return t.valQuote;
    }
    if (form.name.trim().length < 2) return t.valName;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return t.valEmail;
    if (!ageOk) return t.valAge;
    if (!agbOk) return t.valAgb;
    if (form.paymentMethod === "on_site" && turnstileEnabled && !turnstileToken) return t.err.turnstile_failed;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const problem = validate();
    if (problem) { toast.error(problem); return; }

    setSubmitting(true);
    try {
      trackEvent("begin_checkout", { location: "geschenkkorb", currency: "EUR", value: total / 100 });
      const result = await createGiftOrder({
        items: cartLines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
        customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
        handover: form.handover,
        date: form.date,
        time: form.time,
        address: { street: form.street.trim(), zip: form.zip.trim(), city: form.city.trim(), note: form.note.trim() },
        payment_method: form.paymentMethod,
        gift_message: form.giftMessage.trim(),
        age_confirmed: ageOk,
        agb_accepted: agbOk,
        language: lang,
        turnstile_token: form.paymentMethod === "on_site" ? turnstileToken : undefined,
      });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      clear();
      trackEvent("purchase", { location: "geschenkkorb", currency: "EUR", value: result.total_cents / 100, transaction_id: result.order_number });
      navigate(`${prefix}/geschenkkoerbe/danke?reserved=1&nr=${encodeURIComponent(result.order_number)}`);
    } catch (err) {
      const code = err instanceof GiftApiError ? err.code : "generic";
      toast.error(t.err[code] ?? t.err.generic);
      if (code === "sold_out") void loadCatalog(); // Bestand neu laden, Auswahl bleibt erhalten
    } finally {
      setSubmitting(false);
    }
  };

  const agbPath = getLocalizedPath("legal.terms", lang);
  const withdrawalPath = getLocalizedPath("legal.withdrawal", lang);
  const today = berlinParts(now).date;
  const minDate = sched ? earliestDate(form.handover, now, sched) : today;
  const blackedOut = !!settings && !!form.date && isBlackout(form.date, form.handover, settings.blackout_dates);

  return (
    <>
      <Helmet>
        <title>{t.pageTitle}</title>
        <meta name="robots" content="noindex,follow" />
        {/* Marken-Kannibalisierung vermeiden: inhaltliche Seite liegt auf ristorantestoria.de (Entscheidung Antoine 20.11.2026) */}
        <link rel="canonical" href="https://www.ristorantestoria.de/geschenkkoerbe-muenchen/" />
      </Helmet>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
          <header className="mb-8 text-center">
            <Gift className="mx-auto mb-3 h-10 w-10 text-primary" aria-hidden="true" />
            <h1 className="font-serif text-3xl font-bold md:text-4xl">{t.h1}</h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{t.intro}</p>
          </header>

          {(!GIFT_LEGAL_APPROVED || anyLmivIncomplete) && (
            <p role="alert" className="mb-6 rounded-xl border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {t.legalDraftBanner}
            </p>
          )}
          {params.get("cancelled") === "1" && (
            <p role="status" className="mb-6 rounded-xl border border-border bg-secondary/40 p-3 text-sm">{t.cancelled}</p>
          )}
          {deepNotes.map((n, i) => (
            <p key={i} role="status" className="mb-3 rounded-xl border border-border bg-secondary/40 p-3 text-sm">{showDeepNote(n)}</p>
          ))}

          {loadFailed && <p role="alert" className="text-center text-destructive">{t.loadError}</p>}
          {!loadFailed && catalog === null && <p className="text-center text-muted-foreground">{t.loading}</p>}
          {catalog && catalog.length === 0 && <p className="text-center text-muted-foreground">{t.emptyShop}</p>}

          {catalog && catalog.length > 0 && settings && sched && (
            <form onSubmit={handleSubmit} noValidate className="space-y-10">
              <section aria-labelledby="gift-step-basket">
                <h2 id="gift-step-basket" className="mb-4 font-serif text-2xl font-bold">{t.stepBasket}</h2>
                <div className="space-y-6">
                  {catalog.map((b) => (
                    <GiftBasketCard
                      key={b.id}
                      basket={b}
                      lang={lang}
                      onAdd={(variantId, qty) => {
                        const cap = variantIndex.get(variantId)?.variant.available ?? 0;
                        const current = lines.find((l) => l.variantId === variantId)?.qty ?? 0;
                        add(variantId, Math.max(0, Math.min(qty, cap - current)));
                        trackEvent("add_to_cart", { location: "geschenkkorb", item_id: variantId, quantity: qty });
                      }}
                    />
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-border p-5" aria-live="polite">
                  <h3 className="mb-3 font-semibold">{t.cartTitle}</h3>
                  {cartLines.length === 0 && <p className="text-sm text-muted-foreground">{t.cartEmpty}</p>}
                  <ul className="space-y-3">
                    {cartLines.map((l) => (
                      <li key={l.variantId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          {l.qty} × {lang === "de" ? l.basket.name_de : l.basket.name_en} – {lang === "de" ? l.variant.label_de : l.variant.label_en}
                          {l.variant.available < l.qty && <strong className="ml-2 text-destructive">({t.onlyFew(l.variant.available)})</strong>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{formatEuro(l.basket.price_cents * l.qty, lang)}</span>
                          <Button type="button" variant="ghost" size="icon" aria-label={t.remove} onClick={() => setQty(l.variantId, 0)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section aria-labelledby="gift-step-handover">
                <h2 id="gift-step-handover" className="mb-4 font-serif text-2xl font-bold">{t.stepHandover}</h2>
                <RadioGroup value={form.handover} onValueChange={(v) => setForm((f) => ({ ...f, handover: v as Handover, date: "", time: "" }))} className="grid gap-3 md:grid-cols-2">
                  <Label htmlFor="ho-pickup" className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
                    <RadioGroupItem value="pickup" id="ho-pickup" className="mt-1" />
                    <span><span className="block font-semibold">{t.pickup}</span><span className="text-sm font-normal text-muted-foreground">{t.pickupHint}</span></span>
                  </Label>
                  <Label htmlFor="ho-delivery" className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
                    <RadioGroupItem value="delivery" id="ho-delivery" className="mt-1" />
                    <span><span className="block font-semibold">{t.delivery}</span><span className="text-sm font-normal text-muted-foreground">{t.deliveryHint}</span></span>
                  </Label>
                </RadioGroup>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="gift-date">{t.date}</Label>
                    <Input id="gift-date" type="date" min={minDate} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, time: "" }))} />
                    {blackedOut && <p role="alert" className="mt-1 text-sm text-destructive">{t.blackout}</p>}
                  </div>
                  <div>
                    {form.handover === "pickup" ? (
                      <>
                        <Label htmlFor="gift-time">{t.time}</Label>
                        <select id="gift-time" className={selectClass} value={form.time} onChange={(e) => set("time", e.target.value)} disabled={slots.length === 0}>
                          {slots.map((s) => <option key={s} value={s}>{s}{s < "06:00" ? (lang === "de" ? " (nach Mitternacht)" : " (after midnight)") : ""}</option>)}
                        </select>
                        {slots.length === 0 && form.date && !blackedOut && <p className="mt-1 text-sm text-destructive">{t.noSlots}</p>}
                      </>
                    ) : (
                      <>
                        <Label htmlFor="gift-window">{t.window}</Label>
                        <select id="gift-window" className={selectClass} value={form.time} onChange={(e) => set("time", e.target.value)}>
                          {settings.delivery_windows.map((w) => <option key={w.key} value={w.key}>{lang === "de" ? w.label_de : w.label_en}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                </div>

                {form.handover === "delivery" && (
                  <div className="mt-4 grid gap-4 md:grid-cols-6">
                    <div className="md:col-span-6">
                      <Label htmlFor="gift-street">{t.street}</Label>
                      <Input id="gift-street" autoComplete="street-address" maxLength={120} value={form.street} onChange={(e) => set("street", e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="gift-zip">{t.zip}</Label>
                      <Input id="gift-zip" autoComplete="postal-code" inputMode="numeric" maxLength={5} value={form.zip} onChange={(e) => set("zip", e.target.value.replace(/\D/g, ""))} />
                    </div>
                    <div className="md:col-span-4">
                      <Label htmlFor="gift-city">{t.city}</Label>
                      <Input id="gift-city" autoComplete="address-level2" maxLength={80} value={form.city} onChange={(e) => set("city", e.target.value)} />
                    </div>
                    <div className="md:col-span-6">
                      <Label htmlFor="gift-note">{t.deliveryNote}</Label>
                      <Input id="gift-note" maxLength={200} value={form.note} onChange={(e) => set("note", e.target.value)} />
                    </div>
                    <div className="md:col-span-6" aria-live="polite">
                      {quote.status === "loading" && <p className="text-sm text-muted-foreground">{t.quoteLoading}</p>}
                      {quote.status === "ok" && (
                        <p className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                          <strong>{t.quoteLabel}: {formatEuro(quote.feeCents, lang)}</strong> ({t.quoteKm(quote.km)})<br />
                          <span className="text-muted-foreground">{t.quoteForecast}</span>
                        </p>
                      )}
                      {quote.status === "error" && <p role="alert" className="text-sm text-destructive">{t.err[quote.code] ?? t.err.routing_unavailable}</p>}
                    </div>
                  </div>
                )}
              </section>

              <section aria-labelledby="gift-step-contact">
                <h2 id="gift-step-contact" className="mb-4 font-serif text-2xl font-bold">{t.stepContact}</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="gift-name">{t.name}</Label>
                    <Input id="gift-name" autoComplete="name" maxLength={120} value={form.name} onChange={(e) => set("name", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="gift-email">{t.email}</Label>
                    <Input id="gift-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="gift-phone">{t.phone} {form.handover === "delivery" && <span className="text-muted-foreground">{t.phoneRequiredDelivery}</span>}</Label>
                    <Input id="gift-phone" type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="gift-message">{t.giftMessage} <span className="text-muted-foreground">({t.giftMessageLimit})</span></Label>
                    <Textarea id="gift-message" rows={3} maxLength={500} value={form.giftMessage} onChange={(e) => set("giftMessage", e.target.value)} />
                  </div>
                </div>
              </section>

              <section aria-labelledby="gift-step-pay">
                <h2 id="gift-step-pay" className="mb-4 font-serif text-2xl font-bold">{t.stepPay}</h2>
                <RadioGroup value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v as "online" | "on_site")} className="mb-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="online" id="pay-online" />
                    <Label htmlFor="pay-online">{t.payOnline}</Label>
                  </div>
                  {form.handover === "pickup" && (
                    <div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="on_site" id="pay-onsite" />
                        <Label htmlFor="pay-onsite">{t.payOnSite}</Label>
                      </div>
                      {form.paymentMethod === "on_site" && (
                        <div className="ml-6">
                          <p className="mt-1 text-sm text-muted-foreground">{t.payOnSiteHint}</p>
                          <TurnstileWidget lang={lang} onToken={setTurnstileToken} />
                        </div>
                      )}
                    </div>
                  )}
                </RadioGroup>

                <div className="rounded-2xl border border-border p-5">
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt>{t.items}</dt><dd className="tabular-nums">{formatEuro(itemsTotal, lang)}</dd></div>
                    {form.handover === "delivery" && (
                      <div className="flex justify-between">
                        <dt>{t.deliveryFee}</dt>
                        <dd className="tabular-nums">{quote.status === "ok" ? formatEuro(deliveryFee, lang) : "–"}</dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                      <dt>{form.handover === "delivery" ? t.totalForecast : t.total}</dt>
                      <dd className="tabular-nums">{formatEuro(total, lang)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-5 space-y-3 text-sm">
                  <p className="text-muted-foreground">{t.ageNotice}</p>
                  <p className="text-muted-foreground">{t.withdrawal}</p>
                  <div className="flex items-start gap-2">
                    <Checkbox id="gift-age" checked={ageOk} onCheckedChange={(v) => setAgeOk(v === true)} className="mt-0.5" />
                    <Label htmlFor="gift-age" className="font-normal leading-snug">{t.ageLabel}</Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox id="gift-agb" checked={agbOk} onCheckedChange={(v) => setAgbOk(v === true)} className="mt-0.5" />
                    <Label htmlFor="gift-agb" className="font-normal leading-snug">
                      {t.agbPre} <Link to={agbPath} target="_blank" className="underline">{t.agbTerms}</Link> {t.agbMid}{" "}
                      <Link to={withdrawalPath} target="_blank" className="underline">{t.agbWithdrawal}</Link> {t.agbPost}
                    </Label>
                  </div>
                </div>

                <Button type="submit" size="lg" className="mt-6 w-full rounded-full" disabled={submitting}>
                  {submitting ? t.loading : form.paymentMethod === "on_site" ? t.ctaOnSite : t.ctaOnline}
                </Button>
              </section>
            </form>
          )}
        </div>
      </main>
    </>
  );
};

export default GiftOrder;
