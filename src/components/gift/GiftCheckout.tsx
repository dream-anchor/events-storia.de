import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Gift, Minus, Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";
import CheckoutHeader from "@/components/checkout/CheckoutHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from "@/lib/analytics";
import { getLocalizedPath } from "@/config/routes";
import { GIFT_COPY } from "@/lib/gift/copy";
import {
  createGiftOrder,
  fetchGiftCatalog,
  fetchGiftSettings,
  fetchGiftShopConfig,
  GiftApiError,
  quoteDelivery,
} from "@/lib/gift/api";
import { isGiftItem, giftMaxForLine } from "@/lib/gift/cartRules";
import {
  addDays,
  berlinParts,
  checkSchedule,
  earliestDate,
  formatEuro,
  isBlackout,
  MAX_QTY_PER_ORDER,
  pickupSlots,
  type Handover,
  type ScheduleSettings,
} from "@/lib/gift/pricing";
import type { GiftBasket, GiftPublicSettings } from "@/lib/gift/types";
import { qtyLeft } from "@/lib/gift/stock";

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

/** Kassen-Teil für reine Geschenkkorb-Warenkörbe (aus GiftOrder.tsx herausgelöst, Datenquelle = CartContext).
 *  Die Edge Function create-gift-order bleibt autoritativ (Serverpreise, Bestand, MwSt.-Split, Altersbestätigung). */
const GiftCheckout = () => {
  const { language } = useLanguage();
  const lang = language === "de" ? "de" : "en";
  const t = GIFT_COPY[lang];
  const prefix = lang === "en" ? "/en" : "";
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { items, updateQuantity, removeFromCart, removeGiftItems } = useCart();

  const [catalog, setCatalog] = useState<GiftBasket[] | null>(null);
  const [settings, setSettings] = useState<GiftPublicSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<FormState>(loadForm);
  const [quote, setQuote] = useState<QuoteState>({ status: "idle" });
  const [ageOk, setAgeOk] = useState(false);
  const [agbOk, setAgbOk] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // unsichtbares Feld: echte Nutzer lassen es leer
  const formOpenedAt = useRef(Date.now()); // Mindest-Ausfüllzeit wird serverseitig gegen diesen Zeitstempel geprüft
  const [orderable, setOrderable] = useState<boolean | null>(null); // Server-Env GIFT_LEGAL_APPROVED (oder Stripe-Testmodus)
  const [submitting, setSubmitting] = useState(false);
  const [removedNotice, setRemovedNotice] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const quoteSeq = useRef(0);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Rückkehr von der abgebrochenen Stripe-Zahlung: Warenkorb und Angaben sind erhalten
  useEffect(() => {
    if (params.get("cancelled") !== "1") return;
    toast.info(t.cancelled);
    const next = new URLSearchParams(params);
    next.delete("cancelled");
    setParams(next, { replace: true });
  }, [params, setParams, t.cancelled]);

  // Uhr tickt minütlich, damit "heute noch" und Slots aktuell bleiben
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Freigabe kommt vom Server (eine Quelle); bei Fehler nicht blockieren, der Server lehnt sonst selbst ab
    fetchGiftShopConfig().then((c) => setOrderable(c.orderable), () => setOrderable(null));
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

  const variantIndex = useMemo(() => {
    const m = new Map<string, { basket: GiftBasket; variant: GiftBasket["variants"][number] }>();
    for (const b of catalog ?? []) for (const v of b.variants) m.set(v.id, { basket: b, variant: v });
    return m;
  }, [catalog]);

  const giftItems = useMemo(() => items.filter(isGiftItem), [items]);

  // Zeilen mit nicht (mehr) existierenden oder ausverkauften Varianten verwerfen (mit Hinweis)
  const cartLines = useMemo(
    () => giftItems.flatMap((i) => {
      const hit = i.variantId ? variantIndex.get(i.variantId) : undefined;
      return hit && qtyLeft(hit.variant) > 0 ? [{ id: i.id, variantId: i.variantId as string, qty: i.quantity, ...hit }] : [];
    }),
    [giftItems, variantIndex],
  );
  useEffect(() => {
    if (!catalog) return;
    const valid = new Set(cartLines.map((l) => l.id));
    const stale = giftItems.filter((i) => !valid.has(i.id));
    if (stale.length === 0) return;
    stale.forEach((i) => removeFromCart(i.id));
    setRemovedNotice(true);
    toast.info(t.checkoutRemovedUnknown);
  }, [catalog, cartLines, giftItems, removeFromCart, t.checkoutRemovedUnknown]);

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

  const validate = (): string | null => {
    if (cartLines.length === 0) return t.valCart;
    if (cartLines.some((l) => qtyLeft(l.variant) < l.qty)) return t.err.sold_out;
    if (cartLines.reduce((s, l) => s + l.qty, 0) > MAX_QTY_PER_ORDER) return t.valQty;
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
        website: honeypot,
        form_started_at: formOpenedAt.current,
      });
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      // "vor Ort zahlen": noch keine Reservierung, erst der Klick auf den Mail-Link zählt (Double-Opt-in); kein purchase-Event
      navigate(`${prefix}/geschenkkoerbe/danke?awaiting=1${result.order_number ? `&nr=${encodeURIComponent(result.order_number)}` : ""}`);
      removeGiftItems(); // gleicher Render-Durchgang wie navigate: kein Zwischenbild "Warenkorb leer"
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
        <title>{t.checkoutTitle}</title>
        <meta name="robots" content="noindex,follow" />
        {/* Marken-Kannibalisierung vermeiden: inhaltliche Seite liegt auf ristorantestoria.de (Entscheidung Antoine 20.11.2026) */}
        <link rel="canonical" href="https://www.ristorantestoria.de/geschenkkoerbe-muenchen/" />
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        <CheckoutHeader />
        <main className="flex-1">
          <div className="container mx-auto max-w-5xl px-4 py-12 md:py-16">
            <header className="mb-8 text-center">
              <Gift className="mx-auto mb-3 h-10 w-10 text-primary" aria-hidden="true" />
              <h1 className="font-serif text-3xl font-bold md:text-4xl">{t.h1}</h1>
            </header>

            {orderable === false && (
              <p role="alert" className="mb-6 rounded-xl border border-border bg-secondary/40 p-3 text-sm">{t.notOrderable}</p>
            )}
            {removedNotice && (
              <p role="status" className="mb-6 rounded-xl border border-border bg-secondary/40 p-3 text-sm">{t.checkoutRemovedUnknown}</p>
            )}

            {loadFailed && <p role="alert" className="text-center text-destructive">{t.loadError}</p>}
            {!loadFailed && catalog === null && <p className="text-center text-muted-foreground">{t.loading}</p>}

            {catalog && settings && sched && (
              <form onSubmit={handleSubmit} noValidate className="space-y-10">
                {/* Honeypot: für Menschen unsichtbar und nicht erreichbar; Bots füllen es aus */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                  <label htmlFor="gift-website">Website</label>
                  <input id="gift-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                </div>
                <section aria-labelledby="gift-step-basket">
                  <h2 id="gift-step-basket" className="mb-4 font-serif text-2xl font-bold">{t.cartTitle}</h2>
                  <div className="rounded-2xl border border-border p-5" aria-live="polite">
                    {cartLines.length === 0 && <p className="text-sm text-muted-foreground">{t.cartEmpty}</p>}
                    <ul className="space-y-3">
                      {cartLines.map((l) => (
                        <li key={l.variantId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span>
                            {lang === "de" ? l.basket.name_de : l.basket.name_en} – {lang === "de" ? l.variant.label_de : l.variant.label_en}
                            {qtyLeft(l.variant) < l.qty && <strong className="ml-2 text-destructive">({t.onlyFew(l.variant.available ?? 0)})</strong>}
                          </span>
                          <span className="flex items-center gap-2">
                            <Button type="button" variant="outline" size="icon" aria-label="−" onClick={() => updateQuantity(l.id, l.qty - 1)}>
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-6 text-center tabular-nums" aria-label={t.quantity}>{l.qty}</span>
                            <Button type="button" variant="outline" size="icon" aria-label="+" disabled={l.qty >= giftMaxForLine(items, l.id) || l.qty >= qtyLeft(l.variant)} onClick={() => updateQuantity(l.id, l.qty + 1)}>
                              <Plus className="h-4 w-4" />
                            </Button>
                            <span className="w-20 text-right tabular-nums">{formatEuro(l.basket.price_cents * l.qty, lang)}</span>
                            <Button type="button" variant="ghost" size="icon" aria-label={t.remove} onClick={() => removeFromCart(l.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button asChild variant="link" className="mt-3 h-auto p-0">
                      <Link to={getLocalizedPath("catering.giftBaskets", lang)}>{t.backToShop}</Link>
                    </Button>
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

                  <Button type="submit" size="lg" className="mt-6 w-full rounded-full" disabled={submitting || orderable === false}>
                    {submitting ? t.loading : form.paymentMethod === "on_site" ? t.ctaOnSite : t.ctaOnline}
                  </Button>
                </section>
              </form>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default GiftCheckout;
