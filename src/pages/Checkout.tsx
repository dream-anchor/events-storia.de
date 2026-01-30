import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import SEO from '@/components/SEO';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePriceDisplay } from '@/contexts/PriceDisplayContext';
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
import PaymentMethodCard from '@/components/checkout/PaymentMethodCard';
import TimeSlotGrid from '@/components/checkout/TimeSlotGrid';
import StickyMobileCTA from '@/components/checkout/StickyMobileCTA';
import PaymentLogos from '@/components/checkout/PaymentLogos';
import { SmartDatePicker } from '@/components/ui/smart-date-picker';
import Footer from '@/components/Footer';
import { format, parseISO } from 'date-fns';

// Zod schema for checkout form validation with length limits (security)
const checkoutSchema = z.object({
  name: z.string().min(2, 'Name zu kurz').max(100, 'Name zu lang'),
  email: z.string().email('Ungültige E-Mail').max(255, 'E-Mail zu lang'),
  phone: z.string().min(5, 'Telefonnummer zu kurz').max(30, 'Telefonnummer zu lang'),
  company: z.string().max(100, 'Firmenname zu lang').optional().or(z.literal('')),
  deliveryStreet: z.string().max(200, 'Straße zu lang').optional().or(z.literal('')),
  deliveryZip: z.string().max(10, 'PLZ zu lang').optional().or(z.literal('')),
  deliveryCity: z.string().max(100, 'Stadt zu lang').optional().or(z.literal('')),
  deliveryFloor: z.string().max(50, 'Stockwerk zu lang').optional().or(z.literal('')),
  notes: z.string().max(2000, 'Nachricht zu lang').optional().or(z.literal('')),
  billingName: z.string().max(100, 'Name zu lang').optional().or(z.literal('')),
  billingStreet: z.string().max(200, 'Straße zu lang').optional().or(z.literal('')),
  billingZip: z.string().max(10, 'PLZ zu lang').optional().or(z.literal('')),
  billingCity: z.string().max(100, 'Stadt zu lang').optional().or(z.literal('')),
});

interface DeliveryCalculation {
  distanceKm: number;
  deliveryCostNet: number;
  deliveryCostGross: number;
  deliveryVat: number;
  deliveryVatRate: number;
  isFreeDelivery: boolean;
  minimumOrder: number;
  message: string;
  messageEn: string;
  isRoundTrip: boolean;
  oneWayDistanceKm: number;
}

// Accordion step types
type CheckoutStep = 'delivery' | 'customer' | 'payment';

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

const Checkout = () => {
  const { items, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const { language } = useLanguage();
  const { formatPrice, showGross, setShowGross } = usePriceDisplay();
  const navigate = useNavigate();
  const { user, profile } = useCustomerAuth();
  const isMobile = useIsMobile();

  // Accordion state
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('delivery');
  const [completedSteps, setCompletedSteps] = useState<CheckoutStep[]>([]);

  const [formData, setFormData] = useState({
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
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [deliveryCalc, setDeliveryCalc] = useState<DeliveryCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [addressDebounce, setAddressDebounce] = useState<NodeJS.Timeout | null>(null);
  const [dateTimeWarning, setDateTimeWarning] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'billie'>('stripe');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [newsletterSignup, setNewsletterSignup] = useState(true);
  const [chafingDishQuantity, setChafingDishQuantity] = useState(0);

  const CHAFING_DISH = {
    id: 'chafing-dish',
    name: 'Chafing Dish',
    name_en: 'Chafing Dish',
    price: 25.00,
    description: 'Warmhaltegerät zum Ausleihen',
    description_en: 'Warming device for rent'
  };

  // Check step completion
  const isDeliveryStepComplete = useMemo(() => {
    if (formData.deliveryType === 'delivery') {
      return !!(formData.deliveryStreet && formData.deliveryZip && formData.deliveryCity && 
                formData.deliveryFloor && formData.date && formData.time);
    }
    return !!(formData.date && formData.time);
  }, [formData]);

  const isCustomerStepComplete = useMemo(() => {
    return !!(formData.name && formData.email && formData.phone && formData.acceptTerms);
  }, [formData]);

  const isPaymentStepComplete = useMemo(() => {
    return !!paymentMethod;
  }, [paymentMethod]);

  // Get summary text for completed sections
  const getDeliverySummary = () => {
    if (formData.deliveryType === 'pickup') {
      return `${language === 'de' ? 'Selbstabholung' : 'Pickup'} · ${formData.date} ${formData.time}`;
    }
    return `${formData.deliveryCity} · ${formData.date} ${formData.time}`;
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

  const isEventBooking = useMemo(() => {
    return items.some(item => item.id.startsWith('event-'));
  }, [items]);

  const isPizzaOnly = items.length > 0 && items.every(item => item.category === 'pizza');

  const hasWarmDishes = items.some(item => 
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

  // Calculate delivery cost when address changes
  const calculateDelivery = useCallback(async (address: string, pizzaOnlyOrder: boolean) => {
    if (!address || address.trim().length < 10) {
      setDeliveryCalc(null);
      return;
    }

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-delivery', {
        body: { address, isPizzaOnly: pizzaOnlyOrder }
      });

      if (error) {
        console.error('Delivery calculation error:', error);
        setDeliveryCalc(null);
        return;
      }

      if (data.error) {
        console.error('Delivery calculation failed:', data.error);
        setDeliveryCalc(null);
        return;
      }

      setDeliveryCalc(data as DeliveryCalculation);
    } catch (err) {
      console.error('Delivery calculation error:', err);
      setDeliveryCalc(null);
    } finally {
      setIsCalculating(false);
    }
  }, []);

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

  useEffect(() => {
    if (formData.deliveryType !== 'delivery') return;
    
    const address = `${formData.deliveryStreet}, ${formData.deliveryZip} ${formData.deliveryCity}`;
    if (address.trim().length < 10) return;

    if (addressDebounce) {
      clearTimeout(addressDebounce);
    }

    const timeout = setTimeout(() => {
      calculateDelivery(address, isPizzaOnly);
    }, 1000);

    setAddressDebounce(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [formData.deliveryStreet, formData.deliveryZip, formData.deliveryCity, formData.deliveryType, isPizzaOnly]);

  useEffect(() => {
    if (formData.deliveryType === 'pickup') {
      setDeliveryCalc(null);
    }
  }, [formData.deliveryType]);

  // Handle Stripe payment redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderNum = urlParams.get('order');
    
    if (paymentStatus === 'success' && orderNum) {
      const handlePaymentSuccess = async () => {
        try {
          const cachedOrderKey = `stripe_order_${orderNum}`;
          const cachedOrder = localStorage.getItem(cachedOrderKey);
          
          let orderPayload;
          let isEventOrder = false;
          let tableToUpdate: 'catering_orders' | 'event_bookings' = 'catering_orders';
          
          if (cachedOrder) {
            orderPayload = JSON.parse(cachedOrder);
            isEventOrder = orderPayload.isEventBooking === true;
            tableToUpdate = isEventOrder ? 'event_bookings' : 'catering_orders';
            localStorage.removeItem(cachedOrderKey);
          } else {
            const { data: cateringData, error: cateringError } = await supabase
              .from('catering_orders')
              .select('*')
              .eq('order_number', orderNum)
              .single();
            
            if (!cateringError && cateringData) {
              tableToUpdate = 'catering_orders';
              orderPayload = {
                orderId: cateringData.id,
                orderNumber: orderNum,
                customerName: cateringData.customer_name,
                customerEmail: cateringData.customer_email,
                customerPhone: cateringData.customer_phone,
                companyName: cateringData.company_name || undefined,
                billingAddress: {
                  name: cateringData.billing_name || cateringData.customer_name,
                  street: cateringData.billing_street || '',
                  zip: cateringData.billing_zip || '',
                  city: cateringData.billing_city || '',
                  country: cateringData.billing_country || 'Deutschland'
                },
                items: cateringData.items as { id: string; name: string; name_en?: string; quantity: number; price: number }[],
                subtotal: cateringData.total_amount - (cateringData.delivery_cost || 0) - (cateringData.minimum_order_surcharge || 0),
                deliveryCost: cateringData.delivery_cost || 0,
                minimumOrderSurcharge: cateringData.minimum_order_surcharge || 0,
                distanceKm: cateringData.calculated_distance_km || undefined,
                grandTotal: cateringData.total_amount,
                isPickup: cateringData.is_pickup || false,
                paymentMethod: cateringData.payment_method || 'stripe',
                desiredDate: cateringData.desired_date || undefined,
                desiredTime: cateringData.desired_time || undefined,
                deliveryAddress: !cateringData.is_pickup 
                  ? `${cateringData.delivery_street || ''}, ${cateringData.delivery_zip || ''} ${cateringData.delivery_city || ''}`.trim() 
                  : undefined,
                deliveryFloor: cateringData.delivery_floor || undefined,
                hasElevator: cateringData.has_elevator || false,
                notes: cateringData.notes || undefined,
                isEventBooking: false
              };
            } else {
              const { data: eventData, error: eventError } = await supabase
                .from('event_bookings')
                .select('*')
                .eq('booking_number', orderNum)
                .single();
              
              if (!eventError && eventData) {
                isEventOrder = true;
                tableToUpdate = 'event_bookings';
                orderPayload = {
                  orderId: eventData.id,
                  orderNumber: orderNum,
                  customerName: eventData.customer_name,
                  customerEmail: eventData.customer_email,
                  customerPhone: eventData.phone || '',
                  companyName: eventData.company_name || undefined,
                  grandTotal: eventData.total_amount,
                  paymentMethod: 'stripe',
                  desiredDate: eventData.event_date || undefined,
                  desiredTime: eventData.event_time || undefined,
                  notes: eventData.internal_notes || undefined,
                  isEventBooking: true,
                  guestCount: eventData.guest_count,
                  eventPackageId: eventData.package_id
                };
              }
            }
          }
          
          if (orderPayload) {
            if (tableToUpdate === 'event_bookings') {
              await supabase
                .from('event_bookings')
                .update({ payment_status: 'paid' })
                .eq('booking_number', orderNum);
            } else {
              await supabase
                .from('catering_orders')
                .update({ payment_status: 'paid' })
                .eq('order_number', orderNum);
            }
          }

          if (orderPayload) {
            await supabase.functions.invoke('create-lexoffice-invoice', {
              body: { ...orderPayload, documentType: 'invoice', isPaid: true }
            });
            
            await supabase.functions.invoke('send-order-notification', {
              body: { ...orderPayload, paymentStatus: 'paid' }
            });
          }
        } catch (err) {
          console.error('Error creating invoice for paid order:', err);
        }
        
        const successDataKey = `stripe_success_${orderNum}`;
        const successDataStr = localStorage.getItem(successDataKey);
        
        if (successDataStr) {
          try {
            const successData = JSON.parse(successDataStr);
            localStorage.removeItem(successDataKey);
            clearCart();
            navigate('/konto/bestellung-erfolgreich', {
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
            navigate('/konto/bestellung-erfolgreich', {
              state: { orderNumber: orderNum },
              replace: true
            });
          }
        } else {
          clearCart();
          navigate('/konto/bestellung-erfolgreich', {
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

  // Pizza time validation
  const isPizzaTimeValid = (time: string): boolean => {
    if (!time) return false;
    const [hours, minutes] = time.split(':').map(Number);
    const timeValue = hours * 60 + minutes;
    
    const lunch = { start: 12 * 60, end: 14 * 60 + 30 };
    const dinner = { start: 18 * 60, end: 22 * 60 + 30 };
    
    return (timeValue >= lunch.start && timeValue <= lunch.end) ||
           (timeValue >= dinner.start && timeValue <= dinner.end);
  };

  const isWeekendDeliveryTooLate = (selectedDate: string, isPickup: boolean, isEvent: boolean): boolean => {
    // Events happen at the restaurant - no delivery cutoff applies
    if (isEvent) return false;
    if (isPickup) return false;
    
    const orderDate = new Date(selectedDate);
    const dayOfWeek = orderDate.getDay();
    
    if (dayOfWeek !== 0 && dayOfWeek !== 6) return false;
    
    const now = new Date();
    const daysBeforeDeadline = dayOfWeek === 6 ? 2 : 3;
    const thursdayDeadline = new Date(orderDate);
    thursdayDeadline.setDate(orderDate.getDate() - daysBeforeDeadline);
    thursdayDeadline.setHours(23, 59, 59, 999);
    
    return now > thursdayDeadline;
  };

  useEffect(() => {
    if (!formData.date || !formData.time) {
      setDateTimeWarning(null);
      return;
    }
    
    const phoneText = isMobile 
      ? '<a href="tel:01636033912" class="underline font-medium hover:text-amber-800 dark:hover:text-amber-200">0163 6033912</a>'
      : '0163 6033912';
    
    const isPickup = formData.deliveryType === 'pickup';
    
    if (isWeekendDeliveryTooLate(formData.date, isPickup, isEventBooking)) {
      const selectedDate = new Date(formData.date);
      const dayName = selectedDate.getDay() === 6 ? 'Samstag' : 'Sonntag';
      const dayNameEn = selectedDate.getDay() === 6 ? 'Saturday' : 'Sunday';
      
      setDateTimeWarning(
        language === 'de'
          ? `Lieferungen für ${dayName} müssen bis Donnerstag 23:59 Uhr bestellt werden. Für kurzfristige Anfragen: ${phoneText}`
          : `Deliveries for ${dayNameEn} must be ordered by Thursday 11:59 PM. For short-notice requests: ${phoneText}`
      );
      return;
    }
    
    if (isPizzaOnly) {
      if (!isPizzaTimeValid(formData.time)) {
        setDateTimeWarning(
          language === 'de'
            ? 'Pizza-Lieferung ist nur zwischen 12:00-14:30 Uhr und 18:00-22:30 Uhr möglich (Mo-So).'
            : 'Pizza delivery is only available between 12:00-14:30 and 18:00-22:30 (Mon-Sun).'
        );
      } else {
        const now = new Date();
        const selectedDateTime = new Date(`${formData.date}T${formData.time}`);
        const minPizzaTime = new Date(now.getTime() + 60 * 60 * 1000);
        
        if (selectedDateTime < minPizzaTime) {
          setDateTimeWarning(
            language === 'de'
              ? `Die gewählte Zeit ist zu kurzfristig. Bitte mindestens 1 Stunde im Voraus bestellen. Bei Fragen: ${phoneText}`
              : `The selected time is too soon. Please order at least 1 hour in advance. Questions? ${phoneText}`
          );
        } else {
          setDateTimeWarning(null);
        }
      }
    } else {
      const selectedDateTime = new Date(`${formData.date}T${formData.time}`);
      const minDateTime = new Date();
      minDateTime.setHours(minDateTime.getHours() + 24);
      
      if (selectedDateTime < minDateTime) {
        setDateTimeWarning(
          language === 'de'
            ? `Catering-Bestellungen benötigen mindestens 24 Stunden Vorlauf. In dringenden Fällen: ${phoneText}`
            : `Catering orders require at least 24 hours advance notice. For urgent cases: ${phoneText}`
        );
      } else {
        setDateTimeWarning(null);
      }
    }
  }, [formData.date, formData.time, formData.deliveryType, language, isMobile, isPizzaOnly, isEventBooking]);

  // VAT calculations
  const minimumOrderSurcharge = deliveryCalc && totalPrice < deliveryCalc.minimumOrder 
    ? deliveryCalc.minimumOrder - totalPrice 
    : 0;
  
  const chafingDishGross = chafingDishQuantity * CHAFING_DISH.price;
  const chafingDishNet = chafingDishGross / 1.07;
  
  const eventPackagesGross = items
    .filter(item => item.id.startsWith('event-'))
    .reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const regularFoodGross = items
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
  const grandTotal = foodGross + drinksGross + deliveryGross;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    setFormData(prev => ({ ...prev, [target.name]: target.value }));
  };

  // Generate order number - Shop orders are always Stripe-paid
  // EVT-BUCHUNG for events, CAT-BESTELLUNG for catering
  const generateOrderNumber = (isEvent: boolean = false) => {
    const date = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const sequence = Math.floor(Date.now() / 1000) % 1000 + 100;
    
    const prefix = isEvent ? 'EVT-BUCHUNG' : 'CAT-BESTELLUNG';
    return `${prefix}-${day}-${month}-${year}-${sequence}`;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting || isProcessingPayment) {
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

    const zodValidation = checkoutSchema.safeParse({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      company: formData.company,
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
      toast.error(
        language === 'de' 
          ? 'Bitte akzeptieren Sie die AGB und Widerrufsbelehrung' 
          : 'Please accept the terms and cancellation policy'
      );
      return;
    }

    setIsSubmitting(true);
    const newOrderNumber = generateOrderNumber(isEventBooking);
    const existingUserId = user?.id || null;

    const orderItems = [
      ...items.map(item => ({
        id: item.id,
        name: item.name,
        name_en: item.name_en,
        quantity: item.quantity,
        price: item.price
      })),
      ...(chafingDishQuantity > 0 ? [{
        id: CHAFING_DISH.id,
        name: `${CHAFING_DISH.name} (Leihgerät)`,
        name_en: `${CHAFING_DISH.name_en} (rental)`,
        quantity: chafingDishQuantity,
        price: CHAFING_DISH.price
      }] : [])
    ];

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
      const orderId = crypto.randomUUID();
      const eventItem = isEventBooking ? items.find(item => item.id.startsWith('event-')) : null;
      const eventGuestCount = eventItem?.quantity || 0;
      const eventPackageId = eventItem?.id.replace('event-', '') || null;
      
      if (isEventBooking && eventItem) {
        const { error } = await supabase
          .from('event_bookings')
          .insert({
            id: orderId,
            booking_number: newOrderNumber,
            customer_name: formData.name,
            customer_email: formData.email,
            phone: formData.phone,
            company_name: formData.company || null,
            event_date: formData.date,
            event_time: formData.time,
            guest_count: eventGuestCount,
            package_id: eventPackageId,
            total_amount: grandTotal,
            payment_status: paymentMethod === 'stripe' ? 'pending' : 'pending',
            status: 'confirmed',
            internal_notes: fullNotes || null,
            menu_selection: null,
          });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('catering_orders')
          .insert({
            id: orderId,
            order_number: newOrderNumber,
            customer_name: formData.name,
            customer_email: formData.email,
            customer_phone: formData.phone,
            company_name: formData.company || null,
            delivery_street: formData.deliveryType === 'delivery' ? formData.deliveryStreet : null,
            delivery_zip: formData.deliveryType === 'delivery' ? formData.deliveryZip : null,
            delivery_city: formData.deliveryType === 'delivery' ? formData.deliveryCity : null,
            delivery_floor: formData.deliveryType === 'delivery' && formData.deliveryFloor ? formData.deliveryFloor : null,
            has_elevator: formData.deliveryType === 'delivery' ? formData.hasElevator : false,
            delivery_address: formData.deliveryType === 'delivery' ? fullDeliveryAddress : null,
            is_pickup: formData.deliveryType === 'pickup',
            desired_date: formData.date || null,
            desired_time: formData.time || null,
            notes: fullNotes || null,
            items: orderItems,
            total_amount: grandTotal,
            billing_name: billingAddress.name || null,
            billing_street: billingAddress.street || null,
            billing_zip: billingAddress.zip || null,
            billing_city: billingAddress.city || null,
            billing_country: billingAddress.country || null,
            delivery_cost: deliveryCalc?.deliveryCostGross || 0,
            minimum_order_surcharge: minimumOrderSurcharge,
            calculated_distance_km: deliveryCalc?.distanceKm || null,
            payment_method: paymentMethod,
            payment_status: paymentMethod === 'stripe' ? 'pending' : 'pending',
            user_id: existingUserId,
            reference_number: formData.referenceNumber?.trim() || null
          });

        if (error) throw error;
      }

      setOrderNumber(newOrderNumber);
      
      if (paymentMethod === 'stripe' || paymentMethod === 'billie') {
        setIsProcessingPayment(true);
        
        const cachedOrderKey = `stripe_order_${newOrderNumber}`;
        const orderDataForCache = {
          orderId: orderId,
          orderNumber: newOrderNumber,
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          companyName: formData.company || undefined,
          billingAddress: billingAddress,
          items: orderItems,
          subtotal: totalPrice,
          deliveryCost: deliveryCalc?.deliveryCostGross || 0,
          minimumOrderSurcharge: minimumOrderSurcharge,
          distanceKm: deliveryCalc?.distanceKm || undefined,
          grandTotal: grandTotal,
          isPickup: formData.deliveryType === 'pickup',
          desiredDate: formData.date || undefined,
          desiredTime: formData.time || undefined,
          deliveryAddress: formData.deliveryType === 'delivery' ? fullDeliveryAddress : undefined,
          notes: fullNotes || undefined,
          paymentMethod: paymentMethod,
          isEventBooking: isEventBooking,
          guestCount: eventGuestCount || undefined,
          eventPackageName: eventItem?.name || undefined,
          eventPackageId: eventPackageId || undefined
        };
        localStorage.setItem(cachedOrderKey, JSON.stringify(orderDataForCache));
        
        const successDataKey = `stripe_success_${newOrderNumber}`;
        const successData = {
          email: formData.email,
          name: formData.name,
          orderNumber: newOrderNumber,
          orderDetails: {
            items: orderItems.map(item => ({
              name: item.name,
              name_en: item.name_en,
              quantity: item.quantity,
              price: item.price,
              total: item.price * item.quantity
            })),
            deliveryType: formData.deliveryType,
            deliveryAddress: formData.deliveryType === 'delivery' 
              ? `${formData.deliveryStreet}, ${formData.deliveryZip} ${formData.deliveryCity}${formData.deliveryFloor ? ` (${formData.deliveryFloor}${formData.hasElevator ? ', Aufzug' : ''})` : ''}`
              : null,
            date: formData.date,
            time: formData.time,
            subtotal: totalPrice,
            deliveryCost: deliveryCalc?.deliveryCostGross || 0,
            grandTotal: grandTotal,
            paymentMethod: paymentMethod,
            company: formData.company,
            foodVat7: totalVat7,
            deliveryVat19: totalVat19
          }
        };
        localStorage.setItem(successDataKey, JSON.stringify(successData));
        
        try {
          const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
            'create-catering-payment',
            {
              body: {
                amount: grandTotal,
                customerEmail: formData.email,
                customerName: formData.name,
                orderNumber: newOrderNumber,
                items: orderItems.map(i => ({ name: i.name, quantity: i.quantity })),
                paymentMethod: paymentMethod,
              },
            }
          );

          if (paymentError || !paymentData?.url) {
            console.error('Payment error:', paymentError);
            toast.error(language === 'de' ? 'Fehler bei der Zahlungsweiterleitung' : 'Payment redirect error');
            setIsProcessingPayment(false);
            localStorage.removeItem(cachedOrderKey);
            clearCart();
            navigate('/konto/bestellung-erfolgreich', { 
              state: { email: formData.email, name: formData.name, orderNumber: newOrderNumber },
              replace: true
            });
            return;
          }

          try {
            window.location.assign(paymentData.url);
          } catch {
            window.open(paymentData.url, '_self');
          }
          return;
        } catch (payErr) {
          console.error('Payment error:', payErr);
          toast.error(language === 'de' ? 'Fehler bei der Zahlung' : 'Payment error');
          setIsProcessingPayment(false);
          localStorage.removeItem(cachedOrderKey);
          clearCart();
          navigate('/konto/bestellung-erfolgreich', { 
            state: { email: formData.email, name: formData.name, orderNumber: newOrderNumber },
            replace: true
          });
          return;
        }
      }
      
      clearCart();
      navigate('/konto/bestellung-erfolgreich', { 
        state: { 
          email: formData.email, 
          name: formData.name, 
          orderNumber: newOrderNumber,
          orderDetails: {
            items: items.map(item => ({
              name: item.name,
              name_en: item.name_en,
              quantity: item.quantity,
              price: item.price,
              total: item.price * item.quantity
            })),
            deliveryType: formData.deliveryType,
            deliveryAddress: formData.deliveryType === 'delivery' 
              ? `${formData.deliveryStreet}, ${formData.deliveryZip} ${formData.deliveryCity}`
              : null,
            date: formData.date,
            time: formData.time,
            subtotal: totalPrice,
            deliveryCost: deliveryCalc?.deliveryCostGross || 0,
            grandTotal: grandTotal,
            paymentMethod: paymentMethod,
            company: formData.company,
            foodVat7: totalVat7,
            deliveryVat19: totalVat19
          }
        },
        replace: true
      });
    } catch (error) {
      console.error('Order error:', error);
      toast.error(
        language === 'de' 
          ? 'Fehler beim Absenden. Bitte versuchen Sie es erneut.'
          : 'Error submitting order. Please try again.'
      );
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
      disabled={isSubmitting || isProcessingPayment || !formData.acceptTerms}
    >
      {isSubmitting || isProcessingPayment ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {language === 'de' ? 'Wird verarbeitet...' : 'Processing...'}
        </>
      ) : (
        <>
          <Lock className="mr-2 h-4 w-4" />
          {language === 'de' ? 'Zahlungspflichtig bestellen' : 'Place binding order'}
        </>
      )}
    </Button>
  );

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
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <span className="font-serif text-lg">
                          {language === 'de' ? 'Ihre Auswahl' : 'Your Selection'} ({items.length})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{formatPrice(grandTotal)}</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="space-y-3">
                          {items.map((item) => {
                            const name = language === 'en' && item.name_en ? item.name_en : item.name;
                            return (
                              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                                {item.image && (
                                  <img src={item.image} alt={name} className="w-14 h-14 rounded-lg object-cover" loading="lazy" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{name}</p>
                                  <p className="text-xs text-muted-foreground">{item.quantity}× {formatPrice(item.price)}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-6 text-center text-xs">{item.quantity}</span>
                                  <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted">
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                <button type="button" onClick={() => removeFromCart(item.id)} className="p-1 text-destructive hover:bg-destructive/10 rounded">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>

                  {/* Section 1: Delivery & Schedule */}
                  <AccordionSection
                    stepNumber={1}
                    title="Lieferung & Termin"
                    titleEn="Delivery & Schedule"
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
                                <span className="font-medium">{formatPrice(deliveryCalc.deliveryCostGross)}</span>
                              )}
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
                            value={formData.date ? parseISO(formData.date) : undefined}
                            onChange={(date) => {
                              setFormData(prev => ({
                                ...prev,
                                date: date ? format(date, 'yyyy-MM-dd') : ''
                              }));
                            }}
                            language={language as 'de' | 'en'}
                            minLeadDays={isPizzaOnly ? 0 : 1}
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
                      />
                      
                      {dateTimeWarning && (
                        <div className="flex items-start gap-2 mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-amber-700 dark:text-amber-300" dangerouslySetInnerHTML={{ __html: dateTimeWarning }} />
                        </div>
                      )}
                    </div>

                    {/* Chafing Dish Add-On */}
                    {hasWarmDishes && !isEventBooking && (
                      <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4 mt-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-full shrink-0">
                              <Flame className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{language === 'de' ? 'Chafing Dish hinzufügen?' : 'Add Chafing Dish?'}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {language === 'de' ? 'Warmhaltegerät – 25 € pro Stück' : 'Warming device – €25 per unit'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-11 sm:ml-0">
                            <button type="button" onClick={() => setChafingDishQuantity(Math.max(0, chafingDishQuantity - 1))} disabled={chafingDishQuantity === 0} className="w-9 h-9 rounded-full border border-amber-300 dark:border-amber-700 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-40">
                              <Minus className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                            </button>
                            <span className="w-6 text-center font-medium text-amber-700 dark:text-amber-300">{chafingDishQuantity}</span>
                            <button type="button" onClick={() => setChafingDishQuantity(chafingDishQuantity + 1)} className="w-9 h-9 rounded-full border border-amber-300 dark:border-amber-700 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                              <Plus className="h-4 w-4 text-amber-700 dark:text-amber-300" />
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
                        variant="checkout"
                        className="w-full"
                      >
                        {language === 'de' ? 'Weiter zu Kontaktdaten' : 'Continue to Contact'}
                      </Button>
                    </div>
                  </AccordionSection>

                  {/* Section 2: Customer Details */}
                  <AccordionSection
                    stepNumber={2}
                    title="Kundendaten"
                    titleEn="Contact Details"
                    isOpen={currentStep === 'customer'}
                    isCompleted={completedSteps.includes('customer')}
                    completedSummary={isCustomerStepComplete ? getCustomerSummary() : undefined}
                    onToggle={() => completedSteps.includes('delivery') && setCurrentStep('customer')}
                    onEdit={() => handleEditStep('customer')}
                  >
                    {/* Login hint */}
                    {!user && (
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                        <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          <LogIn className="h-4 w-4" />
                          {language === 'de' ? 'Haben Sie ein Konto? ' : 'Have an account? '}
                          <Link to="/login" state={{ redirect: '/checkout' }} className="text-amber-800 dark:text-amber-400 hover:underline font-medium">
                            {language === 'de' ? 'Anmelden' : 'Log in'}
                          </Link>
                        </p>
                      </div>
                    )}

                    {/* Logged in indicator */}
                    {user && (
                      <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
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

                    {/* Terms acceptance */}
                    <div className="mt-6 pt-4 border-t border-border">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="acceptTerms"
                          checked={formData.acceptTerms}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptTerms: checked === true }))}
                          className="mt-0.5"
                        />
                        <Label htmlFor="acceptTerms" className="text-sm leading-relaxed cursor-pointer">
                          {language === 'de' 
                            ? <>Ich habe die <Link to="/agb-catering" target="_blank" className="text-amber-800 dark:text-amber-400 underline hover:text-amber-900 dark:hover:text-amber-300">AGB</Link> und <Link to="/widerrufsbelehrung" target="_blank" className="text-amber-800 dark:text-amber-400 underline hover:text-amber-900 dark:hover:text-amber-300">Widerrufsbelehrung</Link> gelesen und akzeptiere diese. *</>
                            : <>I have read and accept the <Link to="/agb-catering" target="_blank" className="text-amber-800 dark:text-amber-400 underline hover:text-amber-900 dark:hover:text-amber-300">Terms</Link> and <Link to="/widerrufsbelehrung" target="_blank" className="text-amber-800 dark:text-amber-400 underline hover:text-amber-900 dark:hover:text-amber-300">Cancellation Policy</Link>. *</>
                          }
                        </Label>
                      </div>
                    </div>

                    {/* Continue Button */}
                    <div className="mt-6 pt-4 border-t border-border">
                      <Button
                        type="button"
                        onClick={() => handleContinueToNext('customer')}
                        disabled={!isCustomerStepComplete}
                        variant="checkout"
                        className="w-full"
                      >
                        {language === 'de' ? 'Weiter zur Zahlung' : 'Continue to Payment'}
                      </Button>
                    </div>
                  </AccordionSection>

                  {/* Section 3: Payment */}
                  <AccordionSection
                    stepNumber={3}
                    title="Zahlungsmethode"
                    titleEn="Payment Method"
                    isOpen={currentStep === 'payment'}
                    isCompleted={completedSteps.includes('payment')}
                    completedSummary={getPaymentSummary()}
                    onToggle={() => completedSteps.includes('customer') && setCurrentStep('payment')}
                    onEdit={() => handleEditStep('payment')}
                  >
                    <div className="space-y-3">
                      <PaymentMethodCard
                        id="stripe"
                        title={language === 'de' ? 'Sofort bezahlen' : 'Pay Now'}
                        subtitle={language === 'de' ? 'Kreditkarte, Apple Pay, Google Pay, Klarna' : 'Credit card, Apple Pay, Google Pay, Klarna'}
                        badge={language === 'de' ? 'Beliebt' : 'Popular'}
                        badgeColor="green"
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
                    <div className="flex items-start gap-2 p-3 mt-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {language === 'de' 
                          ? 'Sichere Zahlung per Stripe – Ihre Daten bleiben geschützt.'
                          : 'Secure payment via Stripe – Your data stays protected.'}
                      </p>
                    </div>

                    {/* Submit on mobile */}
                    <div className="mt-6 pt-4 border-t border-border lg:hidden">
                      <Button
                        type="submit"
                        variant="checkoutCta"
                        className="w-full h-12"
                        disabled={isSubmitting || isProcessingPayment || !formData.acceptTerms}
                      >
                        {isSubmitting || isProcessingPayment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {language === 'de' ? 'Wird verarbeitet...' : 'Processing...'}
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            {language === 'de' ? 'Zahlungspflichtig bestellen' : 'Place binding order'}
                          </>
                        )}
                      </Button>
                    </div>
                  </AccordionSection>

                </div>

                {/* Right Column: Sticky Summary (Desktop only) */}
                <div className="hidden lg:block">
                  <StickySummary
                    deliveryCost={deliveryCalc?.deliveryCostGross || 0}
                    minimumOrderSurcharge={minimumOrderSurcharge}
                    chafingDishQuantity={chafingDishQuantity}
                    chafingDishPrice={CHAFING_DISH.price}
                    grandTotal={grandTotal}
                    foodVat7={totalVat7}
                    deliveryVat19={totalVat19}
                    isDelivery={formData.deliveryType === 'delivery'}
                    distanceKm={deliveryCalc?.distanceKm}
                    isRoundTrip={deliveryCalc?.isRoundTrip}
                    oneWayDistanceKm={deliveryCalc?.oneWayDistanceKm}
                    ctaButton={ctaButton}
                  />
                </div>
              </div>
            </form>

            {/* Mobile Sticky CTA */}
            <StickyMobileCTA
              totalAmount={grandTotal}
              isSubmitting={isSubmitting || isProcessingPayment}
              paymentMethod={paymentMethod}
              onSubmit={() => {
                const form = document.querySelector('form');
                if (form) form.requestSubmit();
              }}
            />
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default Checkout;
