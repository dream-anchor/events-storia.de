import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackEvent } from '@/lib/analytics';
import { generateOrderNumber } from '@/lib/orderNumber';
import { LocalizedLink } from '@/components/LocalizedLink';
import { useLocalizedPath } from '@/hooks/useLocalizedPath';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import SEO from '@/components/SEO';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePriceDisplay, VAT_RATES, cateringLineParts, itemParts } from '@/contexts/PriceDisplayContext';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Minus, Plus, Trash2, CheckCircle, ArrowLeft, Truck, MapPin, Info, Sparkles, 
  Loader2, CalendarDays, Clock, User, ChevronDown, ShieldCheck, CreditCard, 
  FileText, LogIn, Lock, PartyPopper, Flame 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import CheckoutHeader from '@/components/checkout/CheckoutHeader';
import AccordionSection from '@/components/checkout/AccordionSection';
import StickySummary from '@/components/checkout/StickySummary';
import { VatTotals, splitNetCents, lineNetCents, subtotalNetCents, formatCents } from '@/components/checkout/VatTotals';
import PaymentMethodCard from '@/components/checkout/PaymentMethodCard';
import TimeSlotGrid from '@/components/checkout/TimeSlotGrid';
import SaveForLaterCheckbox from '@/components/checkout/SaveForLaterCheckbox';
import PaymentLogos from '@/components/checkout/PaymentLogos';
import { SmartDatePicker } from '@/components/ui/smart-date-picker';
import Footer from '@/components/Footer';
import GiftCheckout from '@/components/gift/GiftCheckout';
import { isGiftItem } from '@/lib/gift/cartRules';
import { GIFT_COPY } from '@/lib/gift/copy';
import { createGiftOrder, GiftApiError } from '@/lib/gift/api';
import { formatEuroTruncated, formatMixedTotal, giftSubtotalOf } from '@/lib/gift/mixedCart';
import { format, parseISO } from 'date-fns';
import { fetchOrderQuote, createOrderAndPay } from '@/lib/orderApi';
import { checkOrderSchedule, MAX_ADVANCE_DAYS, SCHEDULE_MESSAGES } from '@/lib/orderSchedule';
import {
  deliveryCalcFromQuote,
  describeCartChanges,
  hasCartSync,
  quoteRequestKey,
  reconcileCartWithQuote,
  totalChanged,
  type OrderQuote,
} from '@/lib/orderQuote';
import { KiBadge } from "@/components/KiBadge";
import { kiAltSuffix } from "@/lib/kiAlt";

// Zod schema for checkout form validation with length limits (security)
const checkoutSchema = z
  .object({
    name: z.string().min(2, 'Name zu kurz').max(100, 'Name zu lang'),
    email: z.string().email('Ungültige E-Mail').max(255, 'E-Mail zu lang'),
    phone: z
      .string()
      .trim()
      .min(5, 'Bitte Telefonnummer angeben')
      .max(30, 'Telefonnummer zu lang'),
    company: z.string().max(100, 'Firmenname zu lang').optional().or(z.literal('')),
    deliveryType: z.string().optional(),
    deliveryStreet: z.string().max(200, 'Straße zu lang').optional().or(z.literal('')),
    deliveryZip: z.string().max(10, 'PLZ zu lang').optional().or(z.literal('')),
    deliveryCity: z.string().max(100, 'Stadt zu lang').optional().or(z.literal('')),
    deliveryFloor: z.string().max(50, 'Stockwerk zu lang').optional().or(z.literal('')),
    notes: z.string().max(2000, 'Nachricht zu lang').optional().or(z.literal('')),
    billingName: z.string().max(100, 'Name zu lang').optional().or(z.literal('')),
    billingStreet: z.string().max(200, 'Straße zu lang').optional().or(z.literal('')),
    billingZip: z.string().max(10, 'PLZ zu lang').optional().or(z.literal('')),
    billingCity: z.string().max(100, 'Stadt zu lang').optional().or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    if (val.deliveryType === 'delivery') {
      if (!val.deliveryStreet || !val.deliveryStreet.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryStreet'],
          message: 'Bitte Lieferadresse (Straße & Hausnummer) angeben',
        });
      }
      if (!val.deliveryZip || !val.deliveryZip.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryZip'],
          message: 'Bitte PLZ der Lieferadresse angeben',
        });
      }
      if (!val.deliveryCity || !val.deliveryCity.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryCity'],
          message: 'Bitte Stadt der Lieferadresse angeben',
        });
      }
      if (!val.deliveryFloor || !val.deliveryFloor.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryFloor'],
          message: 'Bitte Stockwerk angeben',
        });
      }
    }
  });

// Accordion step types
type CheckoutStep = 'delivery' | 'customer' | 'payment';

// Form data type
interface CheckoutFormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  deliveryType: string;
  deliveryStreet: string;
  deliveryZip: string;
  deliveryCity: string;
  deliveryFloor: string;
  hasElevator: boolean;
  date: string;
  time: string;
  notes: string;
  wantsSetupService: boolean;
  sameAsDelivery: boolean;
  showBillingAddress: boolean;
  billingName: string;
  billingStreet: string;
  billingZip: string;
  billingCity: string;
  billingCountry: string;
  acceptTerms: boolean;
  referenceNumber: string;
}

// Email validation helper
const validateEmail = (email: string): { valid: boolean; suggestion?: string; error?: string } => {
  const trimmed = email.trim().toLowerCase();
  
  if (!trimmed) {
    return { valid: false, error: 'de:Bitte E-Mail eingeben|en:Please enter email' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'de:Bitte gültige E-Mail-Adresse eingeben|en:Please enter a valid email address' };
  }
  
  const typoMap: Record<string, string> = {
    'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gamil.com': 'gmail.com',
    'gnail.com': 'gmail.com', 'gmeil.com': 'gmail.com', 'gmaill.com': 'gmail.com',
    'gmail.de': 'gmail.com', 'outloo.com': 'outlook.com', 'outlok.com': 'outlook.com',
    'outllok.com': 'outlook.com', 'hotmal.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com',
    'yhoo.com': 'yahoo.com', 'web.de.de': 'web.de', 'gmx.de.de': 'gmx.de',
  };
  
  const domain = trimmed.split('@')[1];
  if (domain && typoMap[domain]) {
    const corrected = trimmed.replace(domain, typoMap[domain]);
    return { 
      valid: false, 
      suggestion: corrected,
      error: `de:Meinten Sie ${corrected}?|en:Did you mean ${corrected}?`
    };
  }
  
  return { valid: true };
};

// Truncate to 2 decimal places without rounding
const formatCurrency = (value: number): string => {
  const truncated = Math.trunc(value * 100) / 100;
  return truncated.toFixed(2).replace('.', ',');
};

// Lieferkosten-Info: gespiegelt aus supabase/functions/calculate-delivery/index.ts
// (NETTO-Konstanten dort; hier brutto inkl. 19 % USt angezeigt, wie im Warenkorb).
const DELIVERY_INFO = {
  vatRate: 0.19,
  netPerTrip: 50,        // 1–8 km: 50 € netto je Fahrt; über 8 km: Anfahrtspauschale 50 € netto je Fahrt
  netPerKm: 1.2,         // über 8 km zusätzlich 1,20 € netto je km und Fahrt
  minOrderUpTo1Km: 50,
  minOrderUpTo8Km: 150,
  minOrderOver8Km: 200,
} as const;
const grossOf = (net: number): number => Math.round(net * (1 + DELIVERY_INFO.vatRate) * 100) / 100;
const formatEuro = (value: number): string =>
  `${value.toLocaleString('de-DE', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })} €`;

const CateringCheckout = () => {
  const { items, updateQuantity, removeFromCart, totalPrice, cateringSubtotal, clearCart, syncFromServer } = useCart();
  // Mischbestellung (Catering + Geschenkkörbe): Körbe laufen über create-gift-order (Serverpreise), nie über die Catering-Beträge.
  const hasGiftItems = items.some(isGiftItem);
  // Catering-Positionen (ohne Körbe); ohne Körbe exakt dieselbe Liste wie bisher
  const cateringItems = hasGiftItems ? items.filter(item => !isGiftItem(item)) : items;
  // Mindestbestellwert: Geschenkkörbe zählen MIT (Entscheidung Antoine 22.11.2026, ersetzt "Entscheidung 19"). Den Aufschlag rechnet allein
  // der Server (quote-catering-order mit giftItems, Korbwert aus der Datenbank); hier steht nur die Anzeige-Basis "Speisen" ohne Körbe.
  const surchargeBase = hasGiftItems ? cateringSubtotal : totalPrice;
  // Korb-Anteil (Anzeige, brutto); wird NICHT an RPC/create-catering-payment gesendet
  const giftSubtotal = hasGiftItems ? giftSubtotalOf(totalPrice, cateringSubtotal) : 0;
  // Körbe für das Server-Angebot: nur Variante + Menge (der Server rechnet den Korbwert für den Mindestbestellwert selbst)
  const giftQuoteItems = useMemo(
    () => items.filter(isGiftItem).filter(i => !!i.variantId).map(i => ({ variant_id: i.variantId as string, qty: i.quantity })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.filter(isGiftItem).map(i => `${i.variantId}:${i.quantity}`).join('|')],
  );
  const { language } = useLanguage();
  const giftText = GIFT_COPY[language === 'de' ? 'de' : 'en'];
  const { formatPrice, formatPriceMixed, showGross, setShowGross } = usePriceDisplay();
  const navigate = useNavigate();
  const { getPath } = useLocalizedPath();
  const { user, profile } = useCustomerAuth();
  const isMobile = useIsMobile();

  // localStorage keys for persistence
  const CHECKOUT_FORM_KEY = 'storia-checkout-form';
  const CHECKOUT_STEP_KEY = 'storia-checkout-step';
  const CHECKOUT_COMPLETED_KEY = 'storia-checkout-completed';

  // Accordion state with localStorage persistence
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CHECKOUT_STEP_KEY);
      if (stored && ['delivery', 'customer', 'payment'].includes(stored)) {
        return stored as CheckoutStep;
      }
    }
    return 'delivery';
  });

  const [completedSteps, setCompletedSteps] = useState<CheckoutStep[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CHECKOUT_COMPLETED_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return parsed.filter(s => ['delivery', 'customer', 'payment'].includes(s));
          }
        } catch (e) {
          // Parsing error: use default
        }
      }
    }
    return [];
  });

  const [formData, setFormData] = useState<CheckoutFormData>(() => {
    const defaultState = {
      name: '',
      email: '',
      phone: '',
      company: '',
      deliveryType: 'delivery',
      deliveryStreet: '',
      deliveryZip: '',
      deliveryCity: '',
      deliveryFloor: '',
      hasElevator: false,
      date: '',
      time: '',
      notes: '',
      wantsSetupService: false,
      sameAsDelivery: true,
      showBillingAddress: false,
      billingName: '',
      billingStreet: '',
      billingZip: '',
      billingCity: '',
      billingCountry: 'Deutschland',
      acceptTerms: false,
      referenceNumber: ''
    };
    
    // Restore from localStorage if available
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(CHECKOUT_FORM_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return { ...defaultState, ...parsed };
        } catch (e) {
          // Parsing error: use default
        }
      }
    }
    return defaultState;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  // Server-Angebot (Abdichtung 22.11.2026): alle Beträge kommen von quote-catering-order, nie aus dem Browser
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [quoteKeyApplied, setQuoteKeyApplied] = useState<string | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [quoteError, setQuoteError] = useState<string | null>(null);
  /** Hinweise zum aktualisierten Warenkorb (Preis/Name geändert, Artikel entfernt) */
  const [cartNotice, setCartNotice] = useState<string[]>([]);
  /** Betrag hat sich seit der letzten Anzeige geändert: alt → neu (Kunde muss den neuen Betrag bestätigen) */
  const [totalNotice, setTotalNotice] = useState<{ from: number; to: number } | null>(null);
  const quoteSeq = useRef(0);
  const lastQuoteRef = useRef<OrderQuote | null>(null);
  // Bestellnummer und Korb-Bestellung bleiben über Wiederholungen gleich (der Server setzt eine unbezahlte Bestellung fort)
  const attemptRef = useRef<{
    orderNumber: string;
    giftKey?: string;
    giftOrderNumber?: string;
    giftTotalEuro?: number;
    giftSuccessItems?: { name: string; name_en: string; quantity: number; price: number; total: number }[];
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'billie'>('stripe');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [newsletterSignup, setNewsletterSignup] = useState(true);
  const [chafingDishQuantity, setChafingDishQuantity] = useState(0);
  const [termsError, setTermsError] = useState(false);
  // nur Mischbestellung: Grußkarte + Altersbestätigung (ab 16) für die Geschenkkörbe
  const [giftMessage, setGiftMessage] = useState('');
  const [giftAgeOk, setGiftAgeOk] = useState(false);

  // GA4: begin_checkout — einmalig beim ersten Laden der Checkout-Seite mit Artikeln
  const beginCheckoutFired = useRef(false);
  useEffect(() => {
    if (beginCheckoutFired.current || items.length === 0) return;
    beginCheckoutFired.current = true;
    trackEvent("begin_checkout", {
      value: totalPrice,
      currency: "EUR",
      num_items: items.length,
    });
  }, [items, totalPrice]);

  // Save for Later feature (DSGVO-compliant opt-in)
  const SAVED_CUSTOMER_KEY = 'storia-saved-customer';
  const SAVED_CUSTOMER_EXPIRY_DAYS = 30;
  const [saveForLater, setSaveForLater] = useState(false);
  const [isDataRestored, setIsDataRestored] = useState(false);

  // Load saved customer data on mount (with expiry check)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedData = localStorage.getItem(SAVED_CUSTOMER_KEY);
    if (!savedData) return;

    try {
      const parsed = JSON.parse(savedData);
      const now = Date.now();

      // Check if data has expired
      if (parsed.expiresAt && now > parsed.expiresAt) {
        localStorage.removeItem(SAVED_CUSTOMER_KEY);
        return;
      }

      // Restore customer data (not delivery/payment data)
      if (parsed.customerData) {
        setFormData(prev => ({
          ...prev,
          name: parsed.customerData.name || prev.name,
          email: parsed.customerData.email || prev.email,
          phone: parsed.customerData.phone || prev.phone,
          company: parsed.customerData.company || prev.company,
        }));
        setSaveForLater(true);
        setIsDataRestored(true);

        // Clear restored indicator after 5 seconds
        setTimeout(() => setIsDataRestored(false), 5000);
      }
    } catch (e) {
      localStorage.removeItem(SAVED_CUSTOMER_KEY);
    }
  }, []);

  // Save customer data when saveForLater is enabled
  const saveCustomerData = useCallback(() => {
    if (!saveForLater) {
      localStorage.removeItem(SAVED_CUSTOMER_KEY);
      return;
    }

    const now = Date.now();
    const expiresAt = now + (SAVED_CUSTOMER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const dataToSave = {
      customerData: {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
      },
      savedAt: now,
      expiresAt,
    };

    localStorage.setItem(SAVED_CUSTOMER_KEY, JSON.stringify(dataToSave));
  }, [saveForLater, formData.name, formData.email, formData.phone, formData.company]);

  // Clear saved customer data
  const clearSavedCustomerData = useCallback(() => {
    localStorage.removeItem(SAVED_CUSTOMER_KEY);
    setSaveForLater(false);
    setIsDataRestored(false);
    toast.success(language === 'de' ? 'Gespeicherte Daten gelöscht' : 'Saved data cleared');
  }, [language]);

  const CHAFING_DISH = {
    id: 'chafing-dish',
    name: 'Chafing Dish',
    name_en: 'Chafing Dish',
    price: 25.00,
    description: 'Warmhaltegerät zum Ausleihen',
    description_en: 'Warming device for rent'
  };

  const isEventBooking = useMemo(() => {
    return items.some(item => item.id.startsWith('event-'));
  }, [items]);

  const isPizzaOnly = cateringItems.length > 0 && cateringItems.every(item => item.category === 'pizza');

  // Minuten-Tick: Vorlauf und Fristen hängen von der aktuellen Uhrzeit ab, Hinweis und gesperrte Zeiten sollen auch ohne Eingabe aktuell bleiben.
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = window.setInterval(() => setScheduleNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Terminverstoß (null = Termin ok). Ohne Uhrzeit nur die zeitunabhängigen Gründe (Wochenend-Frist, Sicherheitslimit),
  // damit der Hinweis schon nach der Datumswahl erscheint. Events sind ausgenommen.
  const scheduleViolation = useMemo(() => {
    if (!formData.date || isEventBooking) return null;
    const reject = checkOrderSchedule(
      { kind: 'catering', isPickup: formData.deliveryType === 'pickup', isPizzaOnly, date: formData.date, time: formData.time || '18:00' }, scheduleNow);
    if (!formData.time && reject !== 'schedule_weekend_cutoff' && reject !== 'schedule_too_far') return null;
    return reject;
  }, [formData.date, formData.time, formData.deliveryType, isEventBooking, isPizzaOnly, scheduleNow]);

  // Check step completion (ein Termin gegen die Regeln gilt als nicht erledigt)
  const isDeliveryStepComplete = useMemo(() => {
    if (scheduleViolation) return false;
    if (formData.deliveryType === 'delivery') {
      return !!(formData.deliveryStreet && formData.deliveryZip && formData.deliveryCity && 
                formData.deliveryFloor && formData.date && formData.time);
    }
    return !!(formData.date && formData.time);
  }, [formData, scheduleViolation]);

  const isCustomerStepComplete = useMemo(() => {
    // Mischbestellung: ohne Altersbestätigung (Checkbox liegt in diesem Schritt) gilt der Schritt nicht als erledigt
    return !!(formData.name && formData.email && formData.phone && formData.acceptTerms && (!hasGiftItems || giftAgeOk));
  }, [formData, hasGiftItems, giftAgeOk]);

  const isPaymentStepComplete = useMemo(() => {
    return !!paymentMethod;
  }, [paymentMethod]);

  // Get summary text for completed sections
  const getDeliverySummary = () => {
    // Format date as DD.MM.YYYY
    const formattedDate = formData.date
      ? new Date(formData.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    const timeStr = formData.time ? ` ${formData.time}` : '';

    if (formData.deliveryType === 'pickup') {
      return `${language === 'de' ? 'Selbstabholung' : 'Pickup'} · ${formattedDate}${timeStr}`;
    }
    return `${formData.deliveryCity} · ${formattedDate}${timeStr}`;
  };

  const getCustomerSummary = () => {
    return `${formData.name} · ${formData.email}`;
  };

  const getPaymentSummary = () => {
    return paymentMethod === 'stripe' 
      ? (language === 'de' ? 'Sofort bezahlen' : 'Pay now')
      : 'Billie Rechnungskauf';
  };

  // Pre-fill form with customer profile data
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || profile.name || '',
        email: prev.email || profile.email || '',
        phone: prev.phone || profile.phone || '',
        company: prev.company || profile.company || '',
        deliveryStreet: prev.deliveryStreet || profile.delivery_street || '',
        deliveryZip: prev.deliveryZip || profile.delivery_zip || '',
        deliveryCity: prev.deliveryCity || profile.delivery_city || '',
        deliveryFloor: prev.deliveryFloor || profile.delivery_floor || '',
        hasElevator: prev.hasElevator || profile.has_elevator || false,
        billingName: prev.billingName || profile.billing_name || '',
        billingStreet: prev.billingStreet || profile.billing_street || '',
        billingZip: prev.billingZip || profile.billing_zip || '',
        billingCity: prev.billingCity || profile.billing_city || '',
      }));
    }
  }, [profile]);

  // Debounced localStorage persistence for formData
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(CHECKOUT_FORM_KEY, JSON.stringify(formData));
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [formData]);

  // Persist currentStep changes
  useEffect(() => {
    localStorage.setItem(CHECKOUT_STEP_KEY, currentStep);
  }, [currentStep]);

  // Persist completedSteps changes
  useEffect(() => {
    localStorage.setItem(CHECKOUT_COMPLETED_KEY, JSON.stringify(completedSteps));
  }, [completedSteps]);

  // Auto-navigate to the furthest complete step on page load
  useEffect(() => {
    // Only run once on mount, skip if cart is empty
    if (items.length === 0) return;

    if (isDeliveryStepComplete && isCustomerStepComplete) {
      setCurrentStep('payment');
      setCompletedSteps(prev => {
        const newSteps = new Set(prev);
        newSteps.add('delivery');
        newSteps.add('customer');
        return Array.from(newSteps) as CheckoutStep[];
      });
    } else if (isDeliveryStepComplete) {
      setCurrentStep('customer');
      setCompletedSteps(prev => {
        const newSteps = new Set(prev);
        newSteps.add('delivery');
        return Array.from(newSteps) as CheckoutStep[];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  const hasWarmDishes = cateringItems.some(item => 
    item.category === 'buffet' || 
    item.name?.toLowerCase().includes('auflauf') ||
    item.name?.toLowerCase().includes('lasagna') ||
    item.name?.toLowerCase().includes('spezzatino') ||
    item.name?.toLowerCase().includes('arrosto') ||
    item.name?.toLowerCase().includes('pollo') ||
    item.name?.toLowerCase().includes('kabeljau') ||
    item.name?.toLowerCase().includes('parmigiana')
  );

  useEffect(() => {
    if (isEventBooking) {
      setFormData(prev => ({ ...prev, deliveryType: 'event' }));
    }
  }, [isEventBooking]);

  const fullDeliveryAddress = (() => {
    let address = `${formData.deliveryStreet}\n${formData.deliveryZip} ${formData.deliveryCity}`;
    if (formData.deliveryFloor) {
      address += `\nStockwerk: ${formData.deliveryFloor}`;
    }
    if (formData.hasElevator) {
      address += `\n(Aufzug vorhanden)`;
    } else if (formData.deliveryFloor) {
      address += `\n(Kein Aufzug)`;
    }
    return address.trim();
  })();

  // ── Server-Angebot: Positionen, Entfernung, Liefergebühr, Aufschlag und Summe berechnet allein der Server ──────────────
  const quoteDeliveryType: 'delivery' | 'pickup' | 'event' =
    isEventBooking ? 'event' : formData.deliveryType === 'delivery' ? 'delivery' : 'pickup';
  const quoteAddressComplete = !!(formData.deliveryStreet.trim() && formData.deliveryZip.trim() && formData.deliveryCity.trim())
    && `${formData.deliveryStreet}, ${formData.deliveryZip} ${formData.deliveryCity}`.trim().length >= 10;
  const quoteNeeded = cateringItems.length > 0 && (quoteDeliveryType !== 'delivery' || quoteAddressComplete);
  const quoteChafing = isEventBooking ? 0 : chafingDishQuantity;
  const currentQuoteKey = useMemo(
    () => quoteRequestKey({
      items: cateringItems.map(i => ({ id: i.id, quantity: i.quantity })),
      chafingQuantity: quoteChafing,
      deliveryType: quoteDeliveryType,
      address: { street: formData.deliveryStreet, zip: formData.deliveryZip, city: formData.deliveryCity },
      giftItems: giftQuoteItems,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cateringItems.map(i => `${i.id}:${i.quantity}`).join('|'), giftQuoteItems, quoteChafing, quoteDeliveryType, formData.deliveryStreet, formData.deliveryZip, formData.deliveryCity],
  );
  // aktuelle Anfrage und Warenkorb für asynchrone Antworten (keine veralteten Closures)
  const quoteParamsRef = useRef<Parameters<typeof fetchOrderQuote>[0] | null>(null);
  quoteParamsRef.current = {
    items: cateringItems.map(i => ({ id: i.id, quantity: i.quantity, price: i.price, name: i.name, name_en: i.name_en })),
    chafingQuantity: quoteChafing,
    deliveryType: quoteDeliveryType,
    address: { street: formData.deliveryStreet, zip: formData.deliveryZip, city: formData.deliveryCity },
    language: language === 'de' ? 'de' : 'en',
    giftItems: giftQuoteItems,
  };
  const cateringItemsRef = useRef(cateringItems);
  cateringItemsRef.current = cateringItems;
  const quoteKeyAppliedRef = useRef<string | null>(null);

  const formatEuroText = useCallback((v: number) =>
    v.toLocaleString(language === 'de' ? 'de-DE' : 'en-GB', { style: 'currency', currency: 'EUR' }), [language]);

  /** Neues Angebot übernehmen: anzeigen, Warenkorb abgleichen (Preise/Namen, entfernte Artikel), Betragsänderung melden. */
  const applyQuote = useCallback((q: OrderQuote, key: string) => {
    const prev = lastQuoteRef.current;
    // Betrag hat sich geändert, obwohl der Kunde nichts angefasst hat (Preis im Admin, Entfernung): Hinweis alt -> neu
    if (prev && quoteKeyAppliedRef.current === key && totalChanged(prev, q)) {
      setTotalNotice({ from: prev.totalCents / 100, to: q.totalCents / 100 });
    }
    lastQuoteRef.current = q;
    quoteKeyAppliedRef.current = key;
    setQuote(q);
    setQuoteKeyApplied(key);
    setQuoteStatus('idle');
    setQuoteError(null);
    const sync = reconcileCartWithQuote(cateringItemsRef.current, q);
    if (hasCartSync(sync)) syncFromServer(sync);
    if (sync.changes.length > 0) {
      setCartNotice(describeCartChanges(sync.changes, language === 'de' ? 'de' : 'en', formatEuroText));
    }
  }, [syncFromServer, language, formatEuroText]);

  const runQuote = useCallback(async (key: string): Promise<OrderQuote | null> => {
    const params = quoteParamsRef.current;
    if (!params) return null;
    const seq = ++quoteSeq.current;
    setQuoteStatus('loading');
    setQuoteError(null);
    const result = await fetchOrderQuote(params);
    if (seq !== quoteSeq.current) return null; // neuere Anfrage läuft bereits
    if (!result.ok) {
      lastQuoteRef.current = null;
      quoteKeyAppliedRef.current = null;
      setQuote(null);
      setQuoteKeyApplied(null);
      setQuoteStatus('error');
      setQuoteError(result.message);
      return null;
    }
    applyQuote(result.quote, key);
    return result.quote;
  }, [applyQuote]);

  useEffect(() => {
    if (!quoteNeeded) {
      quoteSeq.current++;
      lastQuoteRef.current = null;
      quoteKeyAppliedRef.current = null;
      setQuote(null);
      setQuoteKeyApplied(null);
      setQuoteStatus('idle');
      setQuoteError(null);
      return;
    }
    const timeout = setTimeout(() => { void runQuote(currentQuoteKey); }, quoteDeliveryType === 'delivery' ? 800 : 250);
    return () => clearTimeout(timeout);
  }, [quoteNeeded, currentQuoteKey, quoteDeliveryType, runQuote]);

  const deliveryCalc = useMemo(() => deliveryCalcFromQuote(quote), [quote]);
  const isCalculating = quoteStatus === 'loading';
  const quoteFresh = quote !== null && quoteKeyApplied === currentQuoteKey && quoteStatus !== 'loading';

  // Handle Stripe payment redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderNum = urlParams.get('order');
    
    if (paymentStatus === 'success' && orderNum) {
      const handlePaymentSuccess = async () => {
        try {
          // Clean up cached order data from localStorage
          const cachedOrderKey = `stripe_order_${orderNum}`;
          localStorage.removeItem(cachedOrderKey);
          
          // NOTE: Payment status update, LexOffice invoice creation, and 
          // notification emails are handled server-side by the Stripe webhook
          // (handle-stripe-webhook). No client-side DB updates needed.
          // The webhook uses the service role key and bypasses RLS.
          
          console.log(`[Checkout] Payment success redirect for order ${orderNum} — webhook handles processing`);
        } catch (err) {
          console.error('Error in payment success handler:', err);
        }
        
        const successDataKey = `stripe_success_${orderNum}`;
        const successDataStr = localStorage.getItem(successDataKey);
        
        // Clear checkout form persistence on successful payment
        localStorage.removeItem(CHECKOUT_FORM_KEY);
        localStorage.removeItem(CHECKOUT_STEP_KEY);
        localStorage.removeItem(CHECKOUT_COMPLETED_KEY);
        sessionStorage.removeItem('storia-checkout-entry-page');
        
        if (successDataStr) {
          try {
            const successData = JSON.parse(successDataStr);
            localStorage.removeItem(successDataKey);
            clearCart();
            navigate(getPath('account.orderSuccess'), {
              state: {
                email: successData.email,
                name: successData.name,
                orderNumber: successData.orderNumber,
                orderDetails: successData.orderDetails
              },
              replace: true
            });
          } catch {
            clearCart();
            navigate(getPath('account.orderSuccess'), {
              state: { orderNumber: orderNum },
              replace: true
            });
          }
        } else {
          clearCart();
          navigate(getPath('account.orderSuccess'), {
            state: { orderNumber: orderNum },
            replace: true
          });
        }
      };

      handlePaymentSuccess();
    } else if (paymentStatus === 'cancelled') {
      toast.error(
        language === 'de'
          ? 'Zahlung abgebrochen. Bitte versuchen Sie es erneut.'
          : 'Payment cancelled. Please try again.'
      );
      window.history.replaceState({}, '', '/checkout');
    }
  }, [language, navigate, clearCart]);

  // Termin-Regeln: eine Quelle (src/lib/orderSchedule.ts, Spiegel des Servers). Der Hinweis erscheint direkt am Termin,
  // „Weiter" bleibt gesperrt (siehe isDeliveryStepComplete), solange der Termin gegen die Regeln verstößt.
  const dateTimeWarning = useMemo(() => {
    if (!scheduleViolation) return null;
    const phoneText = isMobile
      ? '<a href="tel:01636033912" class="underline font-medium hover:text-amber-800 dark:hover:text-amber-200">0163 6033912</a>'
      : '0163 6033912';
    return SCHEDULE_MESSAGES[scheduleViolation][language === 'de' ? 'de' : 'en'].replace('0163 6033912', phoneText);
  }, [scheduleViolation, language, isMobile]);

  // Uhrzeiten, die gegen die Regeln verstoßen (Vorlauf, Pizza-Fenster, Wochenende vor 12:00), werden gar nicht erst angeboten.
  // Datumsgründe (Wochenend-Frist, Sicherheitslimit) blenden keine Zeiten aus, sie sperren „Weiter" und zeigen den Hinweis.
  const slotAllowed = useCallback((slot: string): boolean => {
    if (!formData.date || isEventBooking) return true;
    const reject = checkOrderSchedule(
      { kind: 'catering', isPickup: formData.deliveryType === 'pickup', isPizzaOnly, date: formData.date, time: slot }, scheduleNow);
    return reject === null || reject === 'schedule_weekend_cutoff' || reject === 'schedule_too_far';
  }, [formData.date, formData.deliveryType, isEventBooking, isPizzaOnly, scheduleNow]);

  // VAT calculations
  // Aufschlag, Liefergebühr und Summe: ausschließlich aus dem Server-Angebot (ohne Angebot: 0, die Summe ist dann nur eine Anzeige-Vorschau)
  const minimumOrderSurcharge = quote ? quote.surchargeCents / 100 : 0;
  
  const chafingDishGross = chafingDishQuantity * CHAFING_DISH.price;
  const chafingDishNet = chafingDishGross / 1.07;
  
  const eventPackagesGross = cateringItems
    .filter(item => item.id.startsWith('event-'))
    .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const regularFoodGross = cateringItems
    .filter(item => !item.id.startsWith('event-'))
    .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const pkgFoodGross = eventPackagesGross * 0.70;
  const pkgDrinksGross = eventPackagesGross * 0.30;
  const pkgFoodNet = pkgFoodGross / 1.07;
  const pkgDrinksNet = pkgDrinksGross / 1.19;
  const pkgFoodVat = pkgFoodGross - pkgFoodNet;
  const pkgDrinksVat = pkgDrinksGross - pkgDrinksNet;
  
  const regularFoodNet = (regularFoodGross + minimumOrderSurcharge) / 1.07 + chafingDishNet;
  const regularFoodVat = (regularFoodGross + minimumOrderSurcharge + chafingDishGross) - regularFoodNet;
  
  const deliveryNet = deliveryCalc?.deliveryCostNet || 0;
  const deliveryGross = deliveryCalc?.deliveryCostGross || 0;
  const deliveryVat = deliveryCalc?.deliveryVat || 0;
  
  const foodGross = regularFoodGross + minimumOrderSurcharge + chafingDishGross + pkgFoodGross;
  const foodNet = regularFoodNet + pkgFoodNet;
  const foodVat = regularFoodVat + pkgFoodVat;
  
  const drinksGross = pkgDrinksGross;
  const drinksNet = pkgDrinksNet;
  const drinksVat = pkgDrinksVat;
  
  const totalNet = foodNet + drinksNet + deliveryNet;
  const totalVat7 = foodVat;
  const totalVat19 = drinksVat + deliveryVat;
  const grandTotal = quote ? quote.totalCents / 100 : foodGross + drinksGross + deliveryGross;
  // Netto-Ansicht: Zwischensumme als REST aus dem Netto-Gesamtbetrag (netC) minus die einzeln gerundeten Netto-Zeilen
  // (Aufschlag, Chafing Dish, Lieferung), damit Zeilen und Summen auf den Cent aufgehen. Nur Anzeige.
  const { netC: cateringNetC } = splitNetCents(grandTotal, totalVat7, drinksVat, deliveryVat);
  const cateringSubtotalDisplay = showGross
    ? formatPriceMixed(cateringLineParts(cateringItems))
    : formatCents(subtotalNetCents(cateringNetC, [
        minimumOrderSurcharge > 0 ? lineNetCents(minimumOrderSurcharge, VAT_RATES.FOOD) : 0,
        chafingDishQuantity > 0 ? lineNetCents(chafingDishQuantity * CHAFING_DISH.price, VAT_RATES.FOOD) : 0,
        formData.deliveryType === 'delivery' && deliveryCalc && !deliveryCalc.isFreeDelivery
          ? lineNetCents(deliveryCalc.deliveryCostGross, VAT_RATES.DELIVERY)
          : 0,
      ]));
  // Anzeige: Catering-Gesamt (+ Körbe brutto). `grandTotal` selbst bleibt der CATERING-Betrag (RPC + create-catering-payment).
  // Der Endbetrag ist IMMER der Brutto-Zahlbetrag, auch im Netto-Modus (der Umschalter ändert nur die Einzelpreise, nie den Stripe-Betrag);
  // im Netto-Modus steht dann "brutto" dabei, mit Körben "inkl. MwSt.". Die Netto-Summe samt "zzgl. MwSt." zeigt <VatTotals>.
  const displayTotal = hasGiftItems ? formatMixedTotal(grandTotal, giftSubtotal) : formatEuroTruncated(grandTotal);
  const totalVatSuffix = hasGiftItems
    ? (language === 'de' ? ' inkl. MwSt.' : ' incl. VAT')
    : (!showGross ? (language === 'de' ? ' brutto' : ' gross') : '');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    setFormData(prev => ({ ...prev, [target.name]: target.value }));
  };

  // Accordion navigation
  const handleContinueToNext = (from: CheckoutStep) => {
    if (from === 'delivery' && isDeliveryStepComplete) {
      setCompletedSteps(prev => [...prev.filter(s => s !== 'delivery'), 'delivery']);
      setCurrentStep('customer');
    } else if (from === 'customer' && isCustomerStepComplete) {
      setCompletedSteps(prev => [...prev.filter(s => s !== 'customer'), 'customer']);
      setCurrentStep('payment');
    }
  };

  const handleEditStep = (step: CheckoutStep) => {
    setCurrentStep(step);
  };

  // Absenden erst, wenn das Angebot zur aktuellen Eingabe frisch ist (nie einen veralteten Betrag bestätigen lassen)
  const deliveryPending = quoteNeeded && !quoteFresh && quoteStatus !== 'error';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || isProcessingPayment) {
      return;
    }

    // Lieferkosten müssen berechnet sein, sonst würde der Server die Bestellung ablehnen
    if (deliveryPending) {
      toast.error(language === 'de'
        ? 'Die Lieferkosten werden noch berechnet. Bitte einen Moment warten.'
        : 'Delivery cost is still being calculated. Please wait a moment.');
      return;
    }

    if (honeypot) {
      toast.success(language === 'de' ? 'Bestellung aufgegeben' : 'Order placed');
      return;
    }
    
    if (items.length === 0) {
      toast.error(language === 'de' ? 'Warenkorb ist leer' : 'Cart is empty');
      return;
    }

    // Check if delivery step is complete - navigate to it if not
    if (!isDeliveryStepComplete) {
      setCurrentStep('delivery');
      // Regelverstoß: die konkrete Meldung (mit Telefonnummer) statt des allgemeinen Hinweises
      toast.error(
        scheduleViolation
          ? SCHEDULE_MESSAGES[scheduleViolation][language === 'de' ? 'de' : 'en']
          : language === 'de'
            ? (isEventBooking ? 'Bitte wählen Sie Datum und Uhrzeit' : 'Bitte füllen Sie zuerst die Lieferdetails aus')
            : (isEventBooking ? 'Please select date and time' : 'Please complete delivery details first'),
        scheduleViolation ? { duration: 10000 } : undefined
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Check if customer step basics are complete
    if (!formData.name || !formData.email || !formData.phone) {
      setCurrentStep('customer');
      if (!completedSteps.includes('delivery')) {
        setCompletedSteps(prev => [...prev, 'delivery']);
      }
      toast.error(
        language === 'de'
          ? 'Bitte füllen Sie Ihre Kontaktdaten aus'
          : 'Please complete your contact details'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Save customer data if opt-in is enabled
    if (saveForLater) {
      saveCustomerData();
    }

    const zodValidation = checkoutSchema.safeParse({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      company: formData.company,
      deliveryType: formData.deliveryType,
      deliveryStreet: formData.deliveryStreet,
      deliveryZip: formData.deliveryZip,
      deliveryCity: formData.deliveryCity,
      deliveryFloor: formData.deliveryFloor,
      notes: formData.notes,
      billingName: formData.billingName,
      billingStreet: formData.billingStreet,
      billingZip: formData.billingZip,
      billingCity: formData.billingCity,
    });
    
    if (!zodValidation.success) {
      const firstError = zodValidation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      const errorMsg = emailValidation.error?.split('|').find(s => s.startsWith(language === 'de' ? 'de:' : 'en:'));
      setEmailError(errorMsg ? errorMsg.slice(3) : emailValidation.error || 'Invalid email');
      toast.error(language === 'de' ? 'Bitte prüfen Sie die E-Mail-Adresse' : 'Please check your email address');
      return;
    }

    if (!formData.date || !formData.time) {
      toast.error(
        language === 'de' 
          ? 'Bitte wählen Sie Datum und Uhrzeit' 
          : 'Please select date and time'
      );
      return;
    }

    if (formData.deliveryType === 'delivery' && !formData.deliveryFloor.trim()) {
      toast.error(
        language === 'de' 
          ? 'Bitte geben Sie das Stockwerk an' 
          : 'Please specify the floor'
      );
      return;
    }

    if (!formData.acceptTerms) {
      setTermsError(true);
      // Make sure customer section is open so user can see the AGB checkbox
      if (!completedSteps.includes('delivery')) {
        setCompletedSteps(prev => [...prev, 'delivery']);
      }
      setCurrentStep('customer');
      toast.error(
        language === 'de'
          ? 'Bitte akzeptieren Sie die AGB'
          : 'Please accept the terms and conditions'
      );
      // Scroll to terms checkbox
      setTimeout(() => {
        const termsCheckbox = document.getElementById('acceptTerms');
        if (termsCheckbox) {
          termsCheckbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }

    // Mischbestellung: Altersbestätigung (ab 16) für die Geschenkkörbe ist Pflicht
    if (hasGiftItems && !giftAgeOk) {
      // Die Checkbox liegt im Schritt "Kundendaten": diesen öffnen und hinscrollen (vorher öffnete sich "Zahlung" -> Checkbox unsichtbar)
      setCurrentStep('customer');
      toast.error(giftText.valAge);
      setTimeout(() => {
        document.getElementById('gift-age')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    // Ohne frisches Server-Angebot wird nichts abgesendet: der Kunde bestätigt nur einen Betrag, den der Server selbst berechnet hat
    if (!quote || !quoteFresh) {
      toast.error(quoteError ?? (language === 'de'
        ? 'Die Preise konnten gerade nicht berechnet werden. Bitte versuchen Sie es erneut. Ihr Warenkorb bleibt erhalten.'
        : 'The prices could not be calculated right now. Please try again. Your cart has been kept.'), { duration: 8000 });
      void runQuote(currentQuoteKey);
      return;
    }
    // Nicht verfügbare Artikel / Gästezahl außerhalb der Grenzen: Der Warenkorb wird angepasst, der Kunde prüft und bestätigt erneut
    if (quote.issues.length > 0) {
      applyQuote(quote, currentQuoteKey);
      toast.error(language === 'de'
        ? 'Ihr Warenkorb wurde angepasst. Bitte prüfen Sie ihn und bestätigen Sie die Bestellung erneut.'
        : 'Your cart has been updated. Please review it and confirm your order again.', { duration: 8000 });
      return;
    }

    // Termin-Regeln (Vorlauf, Pizza-Zeiten, Wochenend-Frist) wie am Server: blockieren, BEVOR eine Korb-Bestellung (Bestand-Hold) angelegt wird
    const scheduleRejected = checkOrderSchedule(
      { kind: quote.kind, isPickup: quote.isPickup, isPizzaOnly: quote.isPizzaOnly, date: formData.date, time: formData.time }, new Date());
    if (scheduleRejected) {
      setCurrentStep('delivery');
      toast.error(SCHEDULE_MESSAGES[scheduleRejected][language === 'de' ? 'de' : 'en'], { duration: 10000 });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    const displayedQuote = quote; // der Betrag, den der Kunde gerade sieht und bestätigt
    const isEventOrder = displayedQuote.kind === 'event';
    // Bestellnummer bleibt über Wiederholungen gleich; der Server setzt eine unbezahlte Bestellung mit gleichem Betrag fort
    if (!attemptRef.current || attemptRef.current.orderNumber.startsWith('EVT-') !== isEventOrder) {
      attemptRef.current = { orderNumber: generateOrderNumber(isEventOrder) };
    }
    const attempt = attemptRef.current;
    const newOrderNumber = attempt.orderNumber;

    // Positionen für Erfolgsseite/Zwischenspeicher: Namen und Preise vom Server
    const orderItems = displayedQuote.lines.map(l => ({
      id: l.id,
      name: l.name,
      name_en: l.name_en ?? l.name,
      quantity: l.quantity,
      price: l.unitCents / 100,
    }));

    let fullNotes = formData.notes || '';
    if (formData.wantsSetupService) {
      fullNotes += (fullNotes ? '\n\n' : '') + '📦 Aufbau & Service gewünscht';
    }

    // Billing address logic: Use delivery address if sameAsDelivery, otherwise use billing fields
    // For pickup: use contact data as fallback when sameAsDelivery is true
    const billingAddress = formData.sameAsDelivery
      ? {
          name: formData.company || formData.name,
          street: formData.deliveryType === 'delivery' ? formData.deliveryStreet : '',
          zip: formData.deliveryType === 'delivery' ? formData.deliveryZip : '',
          city: formData.deliveryType === 'delivery' ? formData.deliveryCity : '',
          country: 'Deutschland'
        }
      : {
          name: formData.billingName || formData.company || formData.name,
          street: formData.billingStreet,
          zip: formData.billingZip,
          city: formData.billingCity,
          country: formData.billingCountry || 'Deutschland'
        };

    try {
      // Mischbestellung, Schritt (a): Geschenkkorb-Bestellung ZUERST anlegen (Serverpreise, Bestand-Hold). Schlägt sie fehl
      // (z. B. ausverkauft), bricht alles ab, es entsteht keine Catering-Bestellung. Bei einer Wiederholung mit gleichem Inhalt
      // wird dieselbe Korb-Bestellung weiterverwendet (kein zweiter Hold); scheitert die Catering-Anlage endgültig, gibt der Server
      // den Hold frei (create-catering-payment).
      let giftOrderNumber: string | undefined;
      // Serverwerte der Korb-Bestellung (für Erfolgsseite); ohne Körbe leer
      let giftSuccessItems: { name: string; name_en: string; quantity: number; price: number; total: number }[] = [];
      let giftTotalEuro = 0;
      if (hasGiftItems) {
        const giftKey = JSON.stringify([
          items.filter(isGiftItem).map(i => [i.variantId, i.quantity]),
          formData.date, formData.time, formData.email, formData.deliveryType === 'pickup', giftMessage.trim(),
        ]);
        if (attempt.giftOrderNumber && attempt.giftKey === giftKey) {
          giftOrderNumber = attempt.giftOrderNumber;
          giftTotalEuro = attempt.giftTotalEuro ?? 0;
          giftSuccessItems = attempt.giftSuccessItems ?? [];
        } else {
          const giftResult = await createGiftOrder({
            items: items.filter(isGiftItem).map(i => ({ variant_id: i.variantId ?? '', qty: i.quantity })),
            customer: { name: formData.name, email: formData.email, phone: formData.phone },
            handover: 'with_catering',
            catering_order_number: newOrderNumber,
            is_pickup: formData.deliveryType === 'pickup',
            date: formData.date,
            time: formData.time,
            address: { street: '', zip: '', city: '', note: '' },
            payment_method: 'online',
            gift_message: giftMessage.trim(),
            age_confirmed: giftAgeOk,
            agb_accepted: formData.acceptTerms,
            language: language === 'de' ? 'de' : 'en',
            website: honeypot,
            form_started_at: Date.now(),
          });
          giftOrderNumber = giftResult.order_number ?? undefined;
          if (!giftOrderNumber) throw new Error('gift_order_missing');
          giftTotalEuro = giftResult.total_cents / 100;
          giftSuccessItems = (giftResult.items ?? []).map(gi => ({
            name: `${gi.name} – ${gi.variant}`,
            name_en: `${gi.name} – ${gi.variant}`,
            quantity: gi.qty,
            price: gi.unit_price_cents / 100,
            total: (gi.unit_price_cents * gi.qty) / 100,
          }));
          attempt.giftKey = giftKey;
          attempt.giftOrderNumber = giftOrderNumber;
          attempt.giftTotalEuro = giftTotalEuro;
          attempt.giftSuccessItems = giftSuccessItems;
        }
      }

      // Bestellung/Buchung am Server berechnen UND anlegen, dann Zahlung starten (create-catering-payment, mode 'create').
      // Weicht der Server-Betrag von dem ab, den der Kunde sieht, wird NICHTS angelegt: der neue Betrag wird angezeigt und neu bestätigt.
      setIsProcessingPayment(true);
      const params = quoteParamsRef.current;
      const result = await createOrderAndPay({
        language: language === 'de' ? 'de' : 'en',
        items: params?.items ?? [],
        chafingQuantity: quoteChafing,
        deliveryType: quoteDeliveryType,
        address: { street: formData.deliveryStreet, zip: formData.deliveryZip, city: formData.deliveryCity },
        addressDetails: { floor: formData.deliveryFloor, hasElevator: formData.hasElevator },
        deliveryAddressText: formData.deliveryType === 'delivery' ? fullDeliveryAddress : null,
        expectedTotalCents: displayedQuote.totalCents,
        orderNumber: newOrderNumber,
        customer: { name: formData.name, email: formData.email, phone: formData.phone, company: formData.company },
        date: formData.date,
        time: formData.time,
        notes: fullNotes,
        billing: billingAddress,
        referenceNumber: formData.referenceNumber?.trim() || '',
        paymentMethod,
        giftOrderNumber,
      });

      if (!result.ok) {
        setIsProcessingPayment(false);
        setIsSubmitting(false);
        if (result.code === 'quote_changed' && result.quote) {
          // Nichts wurde angelegt. Neuen Betrag anzeigen (Hinweis alt → neu) und Warenkorb angleichen; der Kunde bestätigt erneut.
          const before = displayedQuote.totalCents / 100;
          const after = result.quote.totalCents / 100;
          applyQuote(result.quote, currentQuoteKey);
          if (before !== after) setTotalNotice({ from: before, to: after });
          toast.error(result.message, { duration: 12000 });
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        // Bestellung/Korb-Bestellung gehören nicht mehr zusammen oder wurden vom Server beendet: nächste Absendung beginnt neu
        if (['order_exists', 'gift_not_pending', 'gift_not_linked', 'gift_hold_expired', 'gift_order_not_found', 'order_create_failed'].includes(result.code)) {
          attemptRef.current = null;
        }
        toast.error(result.message, { duration: 10000 });
        if (['delivery_unverifiable', 'session_check_unavailable', 'address_missing', 'invalid_items', 'mixed_cart'].includes(result.code) === false && result.code !== 'rate_limited') {
          // Alert: Non-blocking Benachrichtigung bei Checkout-Fehler
          supabase.functions.invoke('notify-checkout-error', {
            body: {
              errorMessage: `${result.code}: ${result.message}`,
              items: items.map(i => ({ name: i.name, quantity: i.quantity })),
              paymentMethod,
              deliveryType: formData.deliveryType,
              timestamp: new Date().toISOString(),
              customerName: formData.name,
              customerEmail: formData.email,
              customerPhone: formData.phone,
              company: formData.company || null,
              desiredDate: formData.date || null,
              desiredTime: formData.time || null,
              grandTotal,
            }
          }).catch(() => {}); // fire-and-forget, nie blockieren
        }
        return;
      }

      setOrderNumber(newOrderNumber);
      const paid = result.quote ?? displayedQuote;
      const paidDelivery = paid.delivery;
      const deliveryCostEuro = paid.deliveryCents / 100;
      const surchargeEuro = paid.surchargeCents / 100;
      const grandTotalEuro = paid.totalCents / 100;
      const isEventBookingOrder = paid.kind === 'event';
      const eventLine = isEventBookingOrder ? paid.lines[0] : null;

      const cachedOrderKey = `stripe_order_${newOrderNumber}`;
      const orderDataForCache = {
        orderNumber: newOrderNumber,
        customerName: formData.name,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        companyName: formData.company || undefined,
        billingAddress: billingAddress,
        items: orderItems,
        subtotal: surchargeBase,
        deliveryCost: deliveryCostEuro,
        minimumOrderSurcharge: surchargeEuro,
        distanceKm: paidDelivery?.oneWayDistanceKm,
        grandTotal: grandTotalEuro,
        isPickup: formData.deliveryType === 'pickup',
        desiredDate: formData.date || undefined,
        desiredTime: formData.time || undefined,
        deliveryAddress: formData.deliveryType === 'delivery' ? fullDeliveryAddress : undefined,
        deliveryFloor: formData.deliveryType === 'delivery' && formData.deliveryFloor ? formData.deliveryFloor : undefined,
        hasElevator: formData.deliveryType === 'delivery' ? formData.hasElevator : false,
        notes: fullNotes || undefined,
        paymentMethod: paymentMethod,
        isEventBooking: isEventBookingOrder,
        guestCount: eventLine?.quantity,
        eventPackageName: eventLine?.name,
        eventPackageId: eventLine?.id.replace('event-', '')
      };
      localStorage.setItem(cachedOrderKey, JSON.stringify(orderDataForCache));

      const successDataKey = `stripe_success_${newOrderNumber}`;
      const successData = {
        email: formData.email,
        name: formData.name,
        orderNumber: newOrderNumber,
        orderDetails: {
          items: [...orderItems.map(item => ({
            name: item.name,
            name_en: item.name_en,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity
          })), ...giftSuccessItems],
          deliveryType: formData.deliveryType,
          deliveryAddress: formData.deliveryType === 'delivery'
            ? `${formData.deliveryStreet}, ${formData.deliveryZip} ${formData.deliveryCity}${formData.deliveryFloor ? ` (${formData.deliveryFloor}${formData.hasElevator ? ', Aufzug' : ''})` : ''}`
            : null,
          date: formData.date,
          time: formData.time,
          subtotal: surchargeBase,
          deliveryCost: deliveryCostEuro,
          grandTotal: grandTotalEuro + giftTotalEuro,
          paymentMethod: paymentMethod,
          company: formData.company,
          foodVat7: totalVat7,
          deliveryVat19: totalVat19
        }
      };
      localStorage.setItem(successDataKey, JSON.stringify(successData));

      // Bestellung angelegt (Server-Preise): Nummer/Korb-Bestellung nicht erneut verwenden, der Kunde verlässt die Seite zur Zahlung
      attemptRef.current = null;
      try {
        window.location.assign(result.url);
      } catch {
        window.open(result.url, '_self');
      }
      return;
    } catch (error) {
      if (error instanceof GiftApiError) {
        // Korb-Bestellung abgelehnt (ausverkauft, Termin, Limit ...): Hinweis zeigen, nichts wurde angelegt
        setIsProcessingPayment(false);
        toast.error(giftText.err[error.code] ?? giftText.err.generic, { duration: 8000 });
        return;
      }
      setIsProcessingPayment(false);
      const errMsg = error instanceof Error ? error.message : (typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : String(error));
      console.error('Order error:', errMsg, error);
      toast.error(
        language === 'de'
          ? `Fehler beim Absenden: ${errMsg}`
          : `Error submitting order: ${errMsg}`,
        { duration: 8000 }
      );
      // Alert: Non-blocking Benachrichtigung bei Checkout-Fehler
      supabase.functions.invoke('notify-checkout-error', {
        body: {
          errorMessage: errMsg,
          items: items.map(i => ({ name: i.name, quantity: i.quantity })),
          paymentMethod,
          deliveryType: formData.deliveryType,
          timestamp: new Date().toISOString(),
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          company: formData.company || null,
          desiredDate: formData.date || null,
          desiredTime: formData.time || null,
          grandTotal,
        }
      }).catch(() => {}); // fire-and-forget, nie blockieren
    } finally {
      setIsSubmitting(false);
    }
  };

  // Empty cart view
  if (items.length === 0) {
    return (
      <>
        <SEO 
          title={language === 'de' ? 'Checkout | STORIA' : 'Checkout | STORIA'}
          description=""
          noIndex={true}
        />
        <div className="min-h-screen bg-background flex flex-col">
          <CheckoutHeader />
          <main className="flex-1 container mx-auto px-4 py-16 text-center">
            <h1 className="text-2xl font-serif mb-4">
              {language === 'de' ? 'Ihr Warenkorb ist leer' : 'Your cart is empty'}
            </h1>
            <Button onClick={() => navigate('/catering/buffet-fingerfood')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {language === 'de' ? 'Zurück zum Menü' : 'Back to menu'}
            </Button>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  // CTA Button for sticky summary
  const ctaButton = (
    <Button
      type="submit"
      form="checkout-form"
      variant="checkoutCta"
      className="w-full h-12 text-base"
      disabled={isSubmitting || isProcessingPayment || deliveryPending}
    >
      {isSubmitting || isProcessingPayment ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {language === 'de' ? 'Wird verarbeitet...' : 'Processing...'}
        </>
      ) : (
        <>
          <Lock className="mr-2 h-4 w-4" />
          {language === 'de' ? 'Sofort kaufen' : 'Buy now'}
        </>
      )}
    </Button>
  );

  // Amazon-style: Check if form is complete to enable CTA early
  const isFormComplete = isDeliveryStepComplete && isCustomerStepComplete && formData.acceptTerms;

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Bestellung aufgeben | STORIA' : 'Place Order | STORIA'}
        description=""
        noIndex={true}
      />
      <div className="min-h-screen bg-muted/30 flex flex-col">
        <CheckoutHeader />
        
        <main className="flex-1 container mx-auto px-4 py-6 md:py-10 pb-32 lg:pb-10">
          <div className="max-w-6xl mx-auto">
            
            {/* Hero text */}
            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-serif font-medium mb-2">
                {language === 'de' ? 'Bestellung aufgeben' : 'Place Your Order'}
              </h1>
              <p className="text-muted-foreground">
                <PartyPopper className="inline h-4 w-4 mr-1" />
                {language === 'de' 
                  ? 'Fast geschafft – nur noch wenige Angaben!' 
                  : 'Almost done – just a few more details!'}
              </p>
            </div>

            {hasGiftItems && (
              <p className="mb-6 rounded-xl border border-border bg-secondary/60 p-4 text-sm">
                {giftText.mixedNote} {giftText.mixedTwoInvoices}
              </p>
            )}

            {/* Server-Angebot: Hinweise zu Änderungen (Warenkorb abgeglichen, Betrag geändert, Berechnung fehlgeschlagen) */}
            {(cartNotice.length > 0 || totalNotice || quoteError) && (
              <div role="alert" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-50">
                {cartNotice.length > 0 && (
                  <div>
                    <p className="font-medium">
                      {language === 'de' ? 'Ihr Warenkorb wurde mit dem aktuellen Angebot abgeglichen:' : 'Your cart has been updated to match the current offer:'}
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {cartNotice.map((line, idx) => <li key={idx}>{line}</li>)}
                    </ul>
                  </div>
                )}
                {totalNotice && (
                  <p className={cn('font-medium', cartNotice.length > 0 && 'mt-2')}>
                    {language === 'de'
                      ? `Der Gesamtbetrag hat sich geändert: ${formatEuroText(totalNotice.from)} → ${formatEuroText(totalNotice.to)}. Bitte prüfen Sie den neuen Betrag und bestätigen Sie Ihre Bestellung erneut.`
                      : `The total has changed: ${formatEuroText(totalNotice.from)} → ${formatEuroText(totalNotice.to)}. Please review the new total and confirm your order again.`}
                  </p>
                )}
                {quoteError && (
                  <p className={cn('font-medium', (cartNotice.length > 0 || totalNotice) && 'mt-2')}>
                    {quoteError}
                    <button type="button" className="ml-2 underline" onClick={() => void runQuote(currentQuoteKey)}>
                      {language === 'de' ? 'Erneut berechnen' : 'Recalculate'}
                    </button>
                  </p>
                )}
                {(cartNotice.length > 0 || totalNotice) && (
                  <button type="button" className="mt-3 text-xs underline" onClick={() => { setCartNotice([]); setTotalNotice(null); }}>
                    {language === 'de' ? 'Verstanden' : 'Got it'}
                  </button>
                )}
              </div>
            )}
            <form id="checkout-form" onSubmit={handleSubmit}>
              {/* Honeypot field */}
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />

              {/* Two-Column Layout */}
              <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">
                
                {/* Left Column: Accordion Sections */}
                <div className="space-y-4">
                  
                  {/* Mobile Cart Overview - outside grid flow on desktop */}
                  <div className="lg:hidden bg-card border border-border rounded-xl p-4">
                    {/* Always visible cost summary */}
                    <div className="space-y-2 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === 'de' ? 'Speisen' : 'Food'}</span>
                        <span>{cateringSubtotalDisplay}</span>
                      </div>
                      {hasGiftItems && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{giftText.mixedGiftsLine}</span>
                        <span>+{formatEuroTruncated(giftSubtotal)}</span>
                      </div>
                      )}
                      {minimumOrderSurcharge > 0 && (
                        <div className="flex justify-between text-amber-600 dark:text-amber-400">
                          <span className="flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            {language === 'de' ? 'Mindestbest.-Aufschlag' : 'Min. order'}
                          </span>
                          <span>+{formatPrice(minimumOrderSurcharge)}</span>
                        </div>
                      )}
                      {chafingDishQuantity > 0 && (
                        <div className="flex justify-between text-amber-600 dark:text-amber-400">
                          <span className="flex items-center gap-1">
                            <Flame className="h-3 w-3" />
                            {chafingDishQuantity}× Chafing Dish
                          </span>
                          <span>+{formatPrice(chafingDishQuantity * CHAFING_DISH.price)}</span>
                        </div>
                      )}
                      {formData.deliveryType === 'delivery' && deliveryCalc && !deliveryCalc.isFreeDelivery && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {language === 'de' ? 'Lieferung' : 'Delivery'}
                            {deliveryCalc.oneWayDistanceKm > 1 && (
                              <span className="text-xs ml-1">({deliveryCalc.oneWayDistanceKm} km{deliveryCalc.isRoundTrip ? ' ×2' : ''})</span>
                            )}
                          </span>
                          <span>+{formatPrice(deliveryCalc.deliveryCostGross, VAT_RATES.DELIVERY)}</span>
                        </div>
                      )}
                      {formData.deliveryType === 'delivery' && deliveryCalc?.isFreeDelivery && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>{language === 'de' ? 'Lieferung' : 'Delivery'}</span>
                          <span>{language === 'de' ? 'Kostenlos' : 'Free'}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-2 border-t border-border font-semibold">
                        <span>{language === 'de' ? 'Gesamt' : 'Total'}{totalVatSuffix}</span>
                        <span className="text-primary">{displayTotal}</span>
                      </div>
                    </div>

                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <span className="flex items-center gap-1">
                          <Info className="h-3 w-3" />
                          {language === 'de' ? 'Details anzeigen' : 'Show details'}
                        </span>
                        <ChevronDown className="h-3 w-3" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="space-y-3">
                          {items.map((item) => {
                            const name = language === 'en' && item.name_en ? item.name_en : item.name;
                            return (
                              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                                {item.image && (
                                  <div className="relative w-14 h-14 shrink-0">
                                    <img src={item.image} alt={`${name} ${kiAltSuffix(language)}`} className="w-full h-full rounded-lg object-cover" loading="lazy" />
                                    <KiBadge size="mini" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{name}</p>
                                  {item.kind === 'gift_basket' && (
                                    <p className="text-xs text-muted-foreground truncate">{language === 'en' && item.variantLabelEn ? item.variantLabelEn : item.variantLabel}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground">{item.quantity}× {isGiftItem(item) ? formatEuroTruncated(item.price) : formatPriceMixed(itemParts(item))}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => {
                                    const step = item.min_order || 1;
                                    const newQty = item.quantity - step;
                                    if (newQty < step) {
                                      removeFromCart(item.id);
                                    } else {
                                      updateQuantity(item.id, newQty);
                                    }
                                  }} className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-6 text-center text-xs">{item.quantity}</span>
                                  <button type="button" onClick={() => {
                                    const step = item.min_order || 1;
                                    updateQuantity(item.id, item.quantity + step);
                                  }} className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                <button type="button" onClick={() => removeFromCart(item.id)} className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                          {/* Pricing breakdown for mobile */}
                          <div className="pt-4 mt-4 border-t border-border space-y-2 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                              <span>{language === 'de' ? 'Zwischensumme' : 'Subtotal'}</span>
                              <span>{cateringSubtotalDisplay}</span>
                            </div>
                            {hasGiftItems && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{giftText.mixedGiftsLine}</span>
                              <span>+{formatEuroTruncated(giftSubtotal)}</span>
                            </div>
                            )}
                            {minimumOrderSurcharge > 0 && (
                              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                <span className="flex items-center gap-1">
                                  <Info className="h-3 w-3" />
                                  {language === 'de' ? 'Mindestbest.-Aufschlag' : 'Min. order surcharge'}
                                </span>
                                <span>+{formatPrice(minimumOrderSurcharge)}</span>
                              </div>
                            )}
                            {chafingDishQuantity > 0 && (
                              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                <span className="flex items-center gap-1">
                                  <Flame className="h-3 w-3" />
                                  {chafingDishQuantity}× Chafing Dish
                                </span>
                                <span>+{formatPrice(chafingDishQuantity * CHAFING_DISH.price)}</span>
                              </div>
                            )}
                            {formData.deliveryType === 'delivery' && deliveryCalc && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>
                                  {language === 'de' ? 'Lieferung' : 'Delivery'}
                                  {deliveryCalc.oneWayDistanceKm > 1 && (
                                    <span className="text-xs text-muted-foreground/70 ml-1">
                                      ({deliveryCalc.oneWayDistanceKm} km{deliveryCalc.isRoundTrip ? ' ×2' : ''})
                                    </span>
                                  )}
                                </span>
                                <span>
                                  {deliveryCalc.isFreeDelivery
                                    ? (language === 'de' ? 'Kostenlos' : 'Free')
                                    : `+${formatPrice(deliveryCalc.deliveryCostGross, VAT_RATES.DELIVERY)}`
                                  }
                                </span>
                              </div>
                            )}
                            {/* MwSt.-Zeilen und Endbetrag (Netto-Modus: zzgl. MwSt., Endbetrag = Brutto-Zahlbetrag) */}
                            <VatTotals
                              variant="inline"
                              language={language === 'de' ? 'de' : 'en'}
                              showGross={showGross}
                              grandTotal={grandTotal}
                              giftSubtotal={giftSubtotal}
                              vat7Food={totalVat7}
                              vat19Drinks={drinksVat}
                              vat19Delivery={deliveryVat}
                            />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* Section 1: Delivery & Schedule (or Date & Time for event bookings) */}
                  <AccordionSection
                    stepNumber={1}
                    title={isEventBooking ? "Datum & Uhrzeit" : "Lieferung & Termin"}
                    titleEn={isEventBooking ? "Date & Time" : "Delivery & Schedule"}
                    isOpen={currentStep === 'delivery'}
                    isCompleted={completedSteps.includes('delivery')}
                    completedSummary={isDeliveryStepComplete ? getDeliverySummary() : undefined}
                    onToggle={() => setCurrentStep('delivery')}
                    onEdit={() => handleEditStep('delivery')}
                  >
                    {/* Delivery Type Selection */}
                    {!isEventBooking && (
                      <div className="flex gap-3 mb-6">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, deliveryType: 'delivery' }))}
                          className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${
                            formData.deliveryType === 'delivery' 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <Truck className="h-5 w-5 mb-2 text-primary" />
                          <p className="font-medium">{language === 'de' ? 'Lieferung' : 'Delivery'}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, deliveryType: 'pickup' }))}
                          className={`flex-1 p-4 rounded-xl border-2 text-left transition-all ${
                            formData.deliveryType === 'pickup' 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <MapPin className="h-5 w-5 mb-2 text-primary" />
                          <p className="font-medium">{language === 'de' ? 'Selbstabholung' : 'Pickup'}</p>
                        </button>
                      </div>
                    )}

                    {/* Delivery Pricing Info - subtle collapsible */}
                    {formData.deliveryType === 'delivery' && !isEventBooking && (
                      <Collapsible className="mb-4">
                        <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group w-full">
                          <Info className="h-3.5 w-3.5" />
                          <span>{language === 'de' ? 'Lieferkosten-Info anzeigen' : 'Show delivery pricing info'}</span>
                          <ChevronDown className="h-3 w-3 ml-auto transition-transform group-data-[state=open]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3">
                          <div className="bg-muted/30 rounded-lg p-4 text-xs space-y-2 border border-border/50">
                            <p className="font-medium text-sm mb-3">
                              {language === 'de' ? '📍 Lieferkosten nach Entfernung' : '📍 Delivery costs by distance'}
                            </p>
                            <div className="grid gap-2">
                              <div className="flex justify-between items-center gap-3">
                                <span>{language === 'de' ? 'Bis 1 km' : 'Up to 1 km'}</span>
                                <span className="font-medium text-right text-green-600 dark:text-green-400">
                                  {language === 'de' ? 'Kostenlos' : 'Free'} <span className="text-muted-foreground font-normal">({language === 'de' ? 'Mindestbestellwert' : 'minimum order'} {formatEuro(DELIVERY_INFO.minOrderUpTo1Km)})</span>
                                </span>
                              </div>
                              <div className="flex justify-between items-center gap-3">
                                <span>1–8 km</span>
                                <span className="font-medium text-right">
                                  {formatEuro(grossOf(DELIVERY_INFO.netPerTrip))} {language === 'de' ? 'pro Fahrt' : 'per trip'} <span className="text-muted-foreground font-normal">({language === 'de' ? 'Mindestbestellwert' : 'minimum order'} {formatEuro(DELIVERY_INFO.minOrderUpTo8Km)})</span>
                                </span>
                              </div>
                              <div className="flex justify-between items-center gap-3">
                                <span>{language === 'de' ? 'Über 8 km' : 'Over 8 km'}</span>
                                <span className="font-medium text-right">
                                  {formatEuro(grossOf(DELIVERY_INFO.netPerTrip))} {language === 'de' ? 'pro Fahrt' : 'per trip'} + {formatEuro(grossOf(DELIVERY_INFO.netPerKm))}/km <span className="text-muted-foreground font-normal">({language === 'de' ? 'Mindestbestellwert' : 'minimum order'} {formatEuro(DELIVERY_INFO.minOrderOver8Km)})</span>
                                </span>
                              </div>
                            </div>
                            <p className="text-muted-foreground pt-2 border-t border-border/50 mt-3">
                              {language === 'de'
                                ? `Catering mit Mehrweggeschirr: Hin- und Rückfahrt (2 Fahrten, z. B. 1–8 km: ${formatEuro(grossOf(DELIVERY_INFO.netPerTrip * 2))}) · Pizza: nur Hinfahrt`
                                : `Catering with reusable tableware: round trip (2 trips, e.g. 1–8 km: ${formatEuro(grossOf(DELIVERY_INFO.netPerTrip * 2))}) · Pizza: one-way only`}
                            </p>
                            <p className="text-muted-foreground">
                              {language === 'de'
                                ? 'Alle Preise inkl. 19 % MwSt. Die genauen Lieferkosten sehen Sie nach Eingabe der Adresse im Warenkorb.'
                                : 'All prices incl. 19% VAT. The exact delivery cost is shown in the cart once you enter your address.'}
                            </p>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Delivery Address Fields */}
                    {formData.deliveryType === 'delivery' && !isEventBooking && (
                      <div className="space-y-4 mb-6">
                        <div>
                          <Label htmlFor="deliveryStreet">{language === 'de' ? 'Straße und Hausnummer' : 'Street and number'} *</Label>
                          <Input
                            id="deliveryStreet"
                            name="deliveryStreet"
                            autoComplete="street-address"
                            value={formData.deliveryStreet}
                            onChange={handleInputChange}
                            required
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="deliveryZip">{language === 'de' ? 'PLZ' : 'Postal Code'} *</Label>
                            <Input
                              id="deliveryZip"
                              name="deliveryZip"
                              autoComplete="postal-code"
                              value={formData.deliveryZip}
                              onChange={handleInputChange}
                              required
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="deliveryCity">{language === 'de' ? 'Stadt' : 'City'} *</Label>
                            <Input
                              id="deliveryCity"
                              name="deliveryCity"
                              autoComplete="address-level2"
                              value={formData.deliveryCity}
                              onChange={handleInputChange}
                              required
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="deliveryFloor">{language === 'de' ? 'Stockwerk' : 'Floor'} *</Label>
                            <Input
                              id="deliveryFloor"
                              name="deliveryFloor"
                              value={formData.deliveryFloor}
                              onChange={handleInputChange}
                              placeholder={language === 'de' ? 'z.B. 3. OG' : 'e.g. 3rd floor'}
                              required
                              className="mt-1"
                            />
                          </div>
                          <div className="flex items-end pb-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="hasElevator"
                                checked={formData.hasElevator}
                                onCheckedChange={(checked) => 
                                  setFormData(prev => ({ ...prev, hasElevator: checked === true }))
                                }
                              />
                              <Label htmlFor="hasElevator" className="font-normal cursor-pointer">
                                {language === 'de' ? 'Aufzug vorhanden' : 'Elevator available'}
                              </Label>
                            </div>
                          </div>
                        </div>

                        {/* Delivery cost calculation */}
                        {isCalculating && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {language === 'de' ? 'Berechne Lieferkosten...' : 'Calculating delivery...'}
                          </div>
                        )}
                        {deliveryCalc && (
                          <div className={`rounded-lg p-4 border ${
                            deliveryCalc.isFreeDelivery
                              ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                              : 'bg-muted/50 border-border'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">
                                {language === 'de' ? deliveryCalc.message : deliveryCalc.messageEn}
                              </span>
                              {!deliveryCalc.isFreeDelivery && (
                                <span className="font-medium">{formatPrice(deliveryCalc.deliveryCostGross, VAT_RATES.DELIVERY)}</span>
                              )}
                            </div>
                            {/* Additional delivery details */}
                            <div className="mt-2 pt-2 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                              {deliveryCalc.oneWayDistanceKm > 1 && (
                                <p>
                                  {language === 'de'
                                    ? `Entfernung: ${deliveryCalc.oneWayDistanceKm} km`
                                    : `Distance: ${deliveryCalc.oneWayDistanceKm} km`}
                                  {deliveryCalc.isRoundTrip && (
                                    <span className="text-muted-foreground/70">
                                      {' '}({language === 'de' ? 'Hin- & Rückfahrt' : 'round trip'})
                                    </span>
                                  )}
                                </p>
                              )}
                              <p>
                                {language === 'de'
                                  ? `Mindestbestellwert: ${formatPrice(deliveryCalc.minimumOrder)}${hasGiftItems ? ' (Geschenkkörbe zählen mit)' : ''}`
                                  : `Minimum order: ${formatPrice(deliveryCalc.minimumOrder)}${hasGiftItems ? ' (gift baskets count towards it)' : ''}`}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pickup Address */}
                    {formData.deliveryType === 'pickup' && (
                      <div className="bg-muted/50 rounded-lg p-4 mb-6">
                        <p className="text-sm font-medium mb-1">{language === 'de' ? 'Abholadresse:' : 'Pickup Address:'}</p>
                        <p className="text-sm text-muted-foreground">
                          STORIA – Ristorante & Bar<br />
                          Karlstr. 47a<br />
                          80333 München
                        </p>
                      </div>
                    )}

                    {/* Date and Time */}
                    <div className="border-t border-border pt-5">
                      <h3 className="font-medium mb-4 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        {isEventBooking
                          ? (language === 'de' ? 'Wann beginnt Ihr Event?' : 'When does your event start?')
                          : (language === 'de' ? 'Wann soll geliefert werden?' : 'When should we deliver?')
                        }
                      </h3>
                      
                      {/* Date Picker */}
                      <div className="mb-5">
                        <Label>{language === 'de' ? 'Datum' : 'Date'} *</Label>
                        <div className="mt-2">
                          <SmartDatePicker
                            value={formData.date ? (() => { const d = parseISO(formData.date); return isNaN(d.getTime()) ? undefined : d; })() : undefined}
                            onChange={(date) => {
                              setFormData(prev => ({
                                ...prev,
                                date: date ? format(date, 'yyyy-MM-dd') : ''
                              }));
                            }}
                            language={language as 'de' | 'en'}
                            minLeadDays={isPizzaOnly ? 0 : 1}
                            maxDays={isEventBooking ? undefined : MAX_ADVANCE_DAYS}
                            skipSundays={isEventBooking}
                            quickSelectCount={3}
                          />
                        </div>
                      </div>
                      
                      {/* Time Slot Grid */}
                      <TimeSlotGrid
                        value={formData.time}
                        onChange={(time) => setFormData(prev => ({ ...prev, time }))}
                        isPizzaOnly={isPizzaOnly}
                        isEventBooking={isEventBooking}
                        isSlotAllowed={slotAllowed}
                      />
                      
                      {dateTimeWarning && (
                        <div className="flex items-start gap-2 mt-4 p-3 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                          <Info className="h-4 w-4 text-neutral-600 dark:text-neutral-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-neutral-700 dark:text-neutral-300" dangerouslySetInnerHTML={{ __html: dateTimeWarning }} />
                        </div>
                      )}
                    </div>

                    {/* Chafing Dish Add-On */}
                    {hasWarmDishes && !isEventBooking && (
                      <div className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 mt-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="bg-neutral-200 dark:bg-neutral-700 p-2.5 rounded-full shrink-0">
                              <Flame className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{language === 'de' ? 'Chafing Dish hinzufügen?' : 'Add Chafing Dish?'}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {language === 'de' ? 'Warmhaltegerät – 25 € pro Stück' : 'Warming device – €25 per unit'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-11 sm:ml-0">
                            <button type="button" onClick={() => setChafingDishQuantity(Math.max(0, chafingDishQuantity - 1))} disabled={chafingDishQuantity === 0} className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-600 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-40">
                              <Minus className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                            </button>
                            <span className="w-6 text-center font-medium text-neutral-700 dark:text-neutral-300">{chafingDishQuantity}</span>
                            <button type="button" onClick={() => setChafingDishQuantity(chafingDishQuantity + 1)} className="w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-600 flex items-center justify-center hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                              <Plus className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Continue Button */}
                    <div className="mt-6 pt-4 border-t border-border">
                      <Button
                        type="button"
                        onClick={() => handleContinueToNext('delivery')}
                        disabled={!isDeliveryStepComplete}
                        variant="checkoutCta"
                        className="w-full h-12"
                      >
                        {language === 'de' ? 'Weiter zu Kontaktdaten' : 'Continue to Contact'}
                      </Button>
                    </div>
                  </AccordionSection>

                  {/* Section 2: Customer Details - only show after step 1 is touched */}
                  {completedSteps.includes('delivery') && (
                  <AccordionSection
                    stepNumber={2}
                    title="Kundendaten"
                    titleEn="Contact Details"
                    isOpen={currentStep === 'customer'}
                    isCompleted={completedSteps.includes('customer')}
                    completedSummary={isCustomerStepComplete ? getCustomerSummary() : undefined}
                    onToggle={() => completedSteps.includes('delivery') && setCurrentStep('customer')}
                    onEdit={() => handleEditStep('customer')}
                    hideHeader
                  >
                    {/* Login hint */}
                    {!user && (
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                        <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          <LogIn className="h-4 w-4" />
                          {language === 'de' ? 'Haben Sie ein Konto? ' : 'Have an account? '}
                          <LocalizedLink to="login" state={{ redirect: '/checkout' }} className="text-neutral-700 dark:text-neutral-300 hover:underline font-medium">
                            {language === 'de' ? 'Anmelden' : 'Log in'}
                          </LocalizedLink>
                        </p>
                      </div>
                    )}

                    {/* Logged in indicator */}
                    {user && (
                      <div className="mb-4 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                        <p className="text-sm text-neutral-600 dark:text-neutral-300 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          {language === 'de' ? `Angemeldet als ${profile?.name || user.email}` : `Logged in as ${profile?.name || user.email}`}
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">{language === 'de' ? 'Name' : 'Name'} *</Label>
                        <Input id="name" name="name" autoComplete="name" value={formData.name} onChange={handleInputChange} required className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="email">E-Mail *</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          onBlur={(e) => {
                            const result = validateEmail(e.target.value);
                            if (!result.valid && result.error) {
                              const errorMsg = result.error.split('|').find(s => s.startsWith(language === 'de' ? 'de:' : 'en:'));
                              setEmailError(errorMsg ? errorMsg.slice(3) : result.error);
                            } else {
                              setEmailError(null);
                            }
                          }}
                          required
                          className={`mt-1 ${emailError ? 'border-destructive' : ''}`}
                        />
                        {emailError && <p className="text-sm text-destructive mt-1">{emailError}</p>}
                      </div>
                      <div>
                        <Label htmlFor="phone">{language === 'de' ? 'Telefon' : 'Phone'} *</Label>
                        <Input id="phone" name="phone" type="tel" autoComplete="tel" value={formData.phone} onChange={handleInputChange} required className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="company">{language === 'de' ? 'Firma (optional)' : 'Company (optional)'}</Label>
                        <Input id="company" name="company" autoComplete="organization" value={formData.company} onChange={handleInputChange} className="mt-1" />
                      </div>
                    </div>

                    {/* Billing Address Toggle - Always visible (Amazon-style) */}
                    {!isEventBooking && (
                      <div className="mt-6 pt-4 border-t border-border">
                        <div className="flex items-center space-x-2 mb-4">
                          <Checkbox
                            id="sameAsDelivery"
                            checked={formData.sameAsDelivery}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sameAsDelivery: checked === true }))}
                          />
                          <Label htmlFor="sameAsDelivery" className="font-normal cursor-pointer">
                            {formData.deliveryType === 'delivery'
                              ? (language === 'de' ? 'Rechnungsadresse gleich Lieferadresse' : 'Billing same as delivery')
                              : (language === 'de' ? 'Keine abweichende Rechnungsadresse' : 'No separate billing address')
                            }
                          </Label>
                        </div>
                        
                        {!formData.sameAsDelivery && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                              <Label htmlFor="billingName">{language === 'de' ? 'Rechnungsempfänger (Name/Firma)' : 'Billing recipient (Name/Company)'} *</Label>
                              <Input id="billingName" name="billingName" value={formData.billingName} onChange={handleInputChange} required={!formData.sameAsDelivery} className="mt-1" />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="billingStreet">{language === 'de' ? 'Straße und Hausnummer' : 'Street and number'} *</Label>
                              <Input id="billingStreet" name="billingStreet" value={formData.billingStreet} onChange={handleInputChange} required={!formData.sameAsDelivery} className="mt-1" />
                            </div>
                            <div>
                              <Label htmlFor="billingZip">{language === 'de' ? 'PLZ' : 'Postal Code'} *</Label>
                              <Input id="billingZip" name="billingZip" value={formData.billingZip} onChange={handleInputChange} required={!formData.sameAsDelivery} className="mt-1" />
                            </div>
                            <div>
                              <Label htmlFor="billingCity">{language === 'de' ? 'Stadt' : 'City'} *</Label>
                              <Input id="billingCity" name="billingCity" value={formData.billingCity} onChange={handleInputChange} required={!formData.sameAsDelivery} className="mt-1" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reference / PO Number - Expandable */}
                    <div className="mt-6">
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                          <ChevronDown className="h-4 w-4" />
                          {language === 'de' ? 'Referenz / PO-Nummer hinzufügen' : 'Add reference / PO number'}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <Input
                            name="referenceNumber"
                            value={formData.referenceNumber}
                            onChange={handleInputChange}
                            placeholder={language === 'de' ? 'Ihre interne Referenz oder PO-Nummer' : 'Your internal reference or PO number'}
                            maxLength={50}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {language === 'de' ? 'Erscheint auf Ihrer Rechnung' : 'Will appear on your invoice'}
                          </p>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {/* Notes */}
                    <div className="mt-4">
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                          <ChevronDown className="h-4 w-4" />
                          {language === 'de' ? 'Anmerkungen hinzufügen (optional)' : 'Add notes (optional)'}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                          <Textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            placeholder={language === 'de' ? 'Besondere Wünsche, Allergien, etc.' : 'Special requests, allergies, etc.'}
                            rows={3}
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>

                    {/* Mischbestellung: Grußkarte + Altersbestätigung für die Geschenkkörbe */}
                    {hasGiftItems && (
                      <div className="mt-6 pt-4 border-t border-border space-y-3">
                        <p className="text-sm text-muted-foreground">{giftText.mixedNote}</p>
                        <div className="space-y-2">
                          <Label htmlFor="gift-message">{giftText.giftMessage} <span className="text-muted-foreground">({giftText.giftMessageLimit})</span></Label>
                          <Textarea id="gift-message" rows={3} maxLength={500} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} />
                        </div>
                        <p className="text-sm text-muted-foreground">{giftText.ageNotice}</p>
                        <p className="text-sm text-muted-foreground">{giftText.withdrawal}</p>
                        <div className="flex items-start space-x-3">
                          <Checkbox id="gift-age" checked={giftAgeOk} onCheckedChange={(v) => setGiftAgeOk(v === true)} className="mt-0.5" />
                          <Label htmlFor="gift-age" className="text-sm font-normal leading-snug cursor-pointer">{giftText.ageLabel} *</Label>
                        </div>
                      </div>
                    )}

                    {/* Terms acceptance */}
                    <div className={cn(
                      "mt-6 pt-4 border-t rounded-lg transition-all",
                      termsError && !formData.acceptTerms
                        ? "border-destructive bg-destructive/5 p-4 -mx-4"
                        : "border-border"
                    )}>
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="acceptTerms"
                          checked={formData.acceptTerms}
                          onCheckedChange={(checked) => {
                            setFormData(prev => ({ ...prev, acceptTerms: checked === true }));
                            if (checked) setTermsError(false);
                          }}
                          className={cn(
                            "mt-0.5",
                            termsError && !formData.acceptTerms && "border-destructive data-[state=unchecked]:border-destructive"
                          )}
                        />
                        <div>
                          <Label htmlFor="acceptTerms" className={cn(
                            "text-sm leading-relaxed cursor-pointer",
                            termsError && !formData.acceptTerms && "text-destructive"
                          )}>
                            {language === 'de'
                              ? <>Ich habe die <LocalizedLink to="legal.terms" target="_blank" className="text-neutral-700 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-neutral-100">AGB</LocalizedLink> gelesen und akzeptiere sie. Mir ist bekannt, dass bei Speisenlieferungen zu einem festen Termin kein Widerrufsrecht besteht. *</>
                              : <>I have read and accept the <LocalizedLink to="legal.terms" target="_blank" className="text-neutral-700 dark:text-neutral-300 underline hover:text-neutral-900 dark:hover:text-neutral-100">Terms and Conditions (AGB)</LocalizedLink>. I am aware that there is no right of withdrawal for food deliveries on a fixed date. *</>
                            }
                          </Label>
                          {termsError && !formData.acceptTerms && (
                            <p className="text-xs text-destructive mt-1 font-medium">
                              {language === 'de'
                                ? '⚠️ Bitte akzeptieren Sie die AGB, um fortzufahren'
                                : '⚠️ Please accept the terms to continue'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Save for Later (DSGVO-compliant opt-in) */}
                    <div className="mt-4">
                      <SaveForLaterCheckbox
                        checked={saveForLater}
                        onChange={(checked) => {
                          setSaveForLater(checked);
                          if (checked) {
                            saveCustomerData();
                          } else {
                            localStorage.removeItem(SAVED_CUSTOMER_KEY);
                          }
                        }}
                        isRestored={isDataRestored}
                        onClearSaved={clearSavedCustomerData}
                      />
                    </div>

                    {/* Continue Button */}
                    <div className="mt-6 pt-4 border-t border-border">
                      <Button
                        type="button"
                        onClick={() => handleContinueToNext('customer')}
                        disabled={!isCustomerStepComplete}
                        className="w-full h-12 bg-[#FFD814] hover:bg-[#F7CA00] text-neutral-900 font-semibold rounded-lg border-0 shadow-sm"
                      >
                        {language === 'de' ? 'Weiter zur Zahlung' : 'Continue to Payment'}
                      </Button>
                    </div>
                  </AccordionSection>
                  )}

                  {/* Section 3: Payment - only show after step 2 is touched */}
                  {completedSteps.includes('customer') && (
                  <AccordionSection
                    stepNumber={3}
                    title="Zahlungsmethode"
                    titleEn="Payment Method"
                    isOpen={currentStep === 'payment'}
                    isCompleted={completedSteps.includes('payment')}
                    completedSummary={getPaymentSummary()}
                    onToggle={() => completedSteps.includes('customer') && setCurrentStep('payment')}
                    onEdit={() => handleEditStep('payment')}
                    hideHeader
                  >
                    <div className="space-y-3">
                      <PaymentMethodCard
                        id="stripe"
                        title={language === 'de' ? 'Sofort bezahlen' : 'Pay Now'}
                        subtitle={language === 'de' ? 'Kreditkarte, Apple Pay, Google Pay, Klarna' : 'Credit card, Apple Pay, Google Pay, Klarna'}
                        badge={language === 'de' ? 'Beliebt' : 'Popular'}
                        badgeColor="default"
                        icon={<CreditCard className="h-5 w-5" />}
                        isSelected={paymentMethod === 'stripe'}
                        onSelect={() => setPaymentMethod('stripe')}
                        logos={<PaymentLogos />}
                      />
                      
                      <PaymentMethodCard
                        id="billie"
                        title={language === 'de' ? 'Rechnungskauf für Unternehmen' : 'B2B Invoice'}
                        subtitle={language === 'de' ? 'Zahlung in 30 Tagen via Billie' : 'Pay in 30 days via Billie'}
                        badge="B2B"
                        badgeColor="blue"
                        icon={<FileText className="h-5 w-5" />}
                        isSelected={paymentMethod === 'billie'}
                        onSelect={() => setPaymentMethod('billie')}
                      />
                    </div>

                    {/* Trust Notice */}
                    <div className="flex items-start gap-2 p-3 mt-4 bg-muted rounded-lg border border-border">
                      <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        {language === 'de' 
                          ? 'Sichere Zahlung per Stripe – Ihre Daten bleiben geschützt.'
                          : 'Secure payment via Stripe – Your data stays protected.'}
                      </p>
                    </div>

                    {/* Submit on mobile */}
                    <div className="mt-6 pt-4 border-t border-border lg:hidden">
                      {!formData.acceptTerms && (
                        <p className="text-xs text-muted-foreground text-center mb-3">
                          {language === 'de'
                            ? '↑ Bitte akzeptieren Sie die AGB oben'
                            : '↑ Please accept the terms above'}
                        </p>
                      )}
                      <Button
                        type="submit"
                        variant="checkoutCta"
                        className="w-full h-12"
                        disabled={isSubmitting || isProcessingPayment || deliveryPending}
                      >
                        {isSubmitting || isProcessingPayment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {language === 'de' ? 'Wird verarbeitet...' : 'Processing...'}
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            {language === 'de' ? 'Sofort kaufen' : 'Buy now'}
                          </>
                        )}
                      </Button>
                    </div>
                  </AccordionSection>
                  )}

                </div>

                {/* Right Column: Sticky Summary (Desktop only) */}
                <div className="hidden lg:block">
                  <StickySummary
                    deliveryCost={deliveryCalc?.deliveryCostGross || 0}
                    minimumOrderSurcharge={minimumOrderSurcharge}
                    chafingDishQuantity={chafingDishQuantity}
                    chafingDishPrice={CHAFING_DISH.price}
                    grandTotal={grandTotal}
                    giftSubtotal={giftSubtotal}
                    foodVat7={totalVat7}
                    drinksVat19={drinksVat}
                    deliveryVat19={deliveryVat}
                    isDelivery={formData.deliveryType === 'delivery'}
                    distanceKm={deliveryCalc?.distanceKm}
                    isRoundTrip={deliveryCalc?.isRoundTrip}
                    oneWayDistanceKm={deliveryCalc?.oneWayDistanceKm}
                    ctaButton={
                      isDeliveryStepComplete && isCustomerStepComplete && (
                        <div>
                          {!formData.acceptTerms && (
                            <p className="text-xs text-muted-foreground text-center mb-2">
                              {language === 'de'
                                ? 'Bitte AGB akzeptieren'
                                : 'Please accept terms'}
                            </p>
                          )}
                          <Button
                            type="submit"
                            variant="checkoutCta"
                            className="w-full h-12"
                            disabled={isSubmitting || isProcessingPayment || deliveryPending}
                          >
                            {isSubmitting || isProcessingPayment ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {language === 'de' ? 'Wird verarbeitet...' : 'Processing...'}
                              </>
                            ) : (
                              <>
                                <Lock className="mr-2 h-4 w-4" />
                                {language === 'de' ? 'Sofort kaufen' : 'Buy now'}
                              </>
                            )}
                          </Button>
                        </div>
                      )
                    }
                  />
                </div>
              </div>
            </form>

            {/* Mobile Sticky CTA - Always visible on mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 lg:hidden z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
              <div className="container mx-auto max-w-lg">
                {/* Show what's missing */}
                {(!isDeliveryStepComplete || !isCustomerStepComplete || !formData.acceptTerms) && (
                  <p className="text-xs text-muted-foreground text-center mb-2">
                    {!isDeliveryStepComplete
                      ? scheduleViolation
                        ? `⚠️ ${SCHEDULE_MESSAGES[scheduleViolation][language === 'de' ? 'de' : 'en']}`
                        : (language === 'de'
                          ? (isEventBooking ? '⚠️ Bitte Datum & Uhrzeit wählen' : '⚠️ Bitte Lieferdetails ausfüllen')
                          : (isEventBooking ? '⚠️ Please select date & time' : '⚠️ Please fill delivery details'))
                      : !formData.name || !formData.email || !formData.phone
                        ? (language === 'de' ? '⚠️ Bitte Kontaktdaten ausfüllen' : '⚠️ Please fill contact details')
                        : !formData.acceptTerms
                          ? (language === 'de' ? '⚠️ Bitte AGB akzeptieren' : '⚠️ Please accept terms')
                          : hasGiftItems && !giftAgeOk
                            ? `⚠️ ${giftText.valAge}`
                            : ''
                    }
                  </p>
                )}
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">{language === 'de' ? 'Gesamt:' : 'Total:'}{totalVatSuffix}</span>
                    <span className="font-bold text-lg ml-1">{displayTotal}</span>
                  </div>
                  <Button
                    type="submit"
                    form="checkout-form"
                    variant="checkoutCta"
                    className="flex-1 max-w-[200px] h-11"
                    disabled={isSubmitting || isProcessingPayment || deliveryPending}
                  >
                    {isSubmitting || isProcessingPayment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {language === 'de' ? 'Lädt...' : 'Loading...'}
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        {language === 'de' ? 'Kaufen' : 'Buy'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

/** Weiche nach Warenkorb-Inhalt: nur Geschenkkörbe -> GiftCheckout; sonst unverändert das Catering-Formular. */
const Checkout = () => {
  const { items } = useCart();
  const onlyGifts = items.length > 0 && items.every(isGiftItem);
  return onlyGifts ? <GiftCheckout /> : <CateringCheckout />;
};

export default Checkout;
