import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePriceDisplay } from '@/contexts/PriceDisplayContext';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Keep for notes field
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Minus, Plus, Trash2, CheckCircle, ArrowLeft, Truck, MapPin, Info, Sparkles, Loader2, CalendarDays, Clock, User, ChevronDown, ShieldCheck, CreditCard, FileText, LogIn, Lock, PartyPopper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ProgressSteps from '@/components/checkout/ProgressSteps';
// TimeSlotPicker removed - using native time input
import StickyMobileCTA from '@/components/checkout/StickyMobileCTA';
import TrustBadges from '@/components/checkout/TrustBadges';
import PaymentLogos from '@/components/checkout/PaymentLogos';

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
// Dialog removed - using direct navigation to success page

// Email validation helper
const validateEmail = (email: string): { valid: boolean; suggestion?: string; error?: string } => {
  const trimmed = email.trim().toLowerCase();
  
  if (!trimmed) {
    return { valid: false, error: 'de:Bitte E-Mail eingeben|en:Please enter email' };
  }
  
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'de:Bitte gültige E-Mail-Adresse eingeben|en:Please enter a valid email address' };
  }
  
  // Common typo detection
  const typoMap: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gmeil.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gmail.de': 'gmail.com',
    'outloo.com': 'outlook.com',
    'outlok.com': 'outlook.com',
    'outllok.com': 'outlook.com',
    'hotmal.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'yhoo.com': 'yahoo.com',
    'web.de.de': 'web.de',
    'gmx.de.de': 'gmx.de',
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

const Checkout = () => {
  const { items, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const { language } = useLanguage();
  const { formatPrice, showGross } = usePriceDisplay();
  const navigate = useNavigate();
  const { user, profile, signup } = useCustomerAuth();
  const isMobile = useIsMobile();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    deliveryType: 'delivery',
    // Structured delivery address
    deliveryStreet: '',
    deliveryZip: '',
    deliveryCity: '',
    deliveryFloor: '',
    hasElevator: false,
    date: '',
    time: '',
    notes: '',
    wantsSetupService: false,
    // Billing address
    sameAsDelivery: true,
    showBillingAddress: false, // For pickup: expandable
    billingName: '',
    billingStreet: '',
    billingZip: '',
    billingCity: '',
    billingCountry: 'Deutschland'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  // showSuccess state removed - using direct navigation
  const [orderNumber, setOrderNumber] = useState('');
  const [deliveryCalc, setDeliveryCalc] = useState<DeliveryCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [addressDebounce, setAddressDebounce] = useState<NodeJS.Timeout | null>(null);
  const [dateTimeWarning, setDateTimeWarning] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'invoice' | 'stripe'>('stripe');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [newsletterSignup, setNewsletterSignup] = useState(true);
  
  // Account creation moved to separate page /kunde/registrieren

  // Calculate current checkout step for progress indicator
  const currentStep = useMemo(() => {
    const hasContact = formData.name && formData.email && formData.phone;
    const hasPayment = paymentMethod;
    if (!hasContact) return 1;
    if (!hasPayment) return 2;
    return 2; // Still on payment/form step until submit
  }, [formData.name, formData.email, formData.phone, paymentMethod]);

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

  // Check if order contains only pizza (no equipment pickup needed)
  const isPizzaOnly = items.length > 0 && items.every(item => item.category === 'pizza');

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

  // Compose full address from structured fields (including floor and elevator for LexOffice)
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

  // Debounced address calculation when fields change
  useEffect(() => {
    if (formData.deliveryType !== 'delivery') return;
    
    const address = `${formData.deliveryStreet}, ${formData.deliveryZip} ${formData.deliveryCity}`;
    if (address.trim().length < 10) return;

    // Clear previous timeout
    if (addressDebounce) {
      clearTimeout(addressDebounce);
    }

    // Set new debounced calculation
    const timeout = setTimeout(() => {
      calculateDelivery(address, isPizzaOnly);
    }, 1000);

    setAddressDebounce(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [formData.deliveryStreet, formData.deliveryZip, formData.deliveryCity, formData.deliveryType, isPizzaOnly]);

  // Reset delivery calc when switching to pickup
  useEffect(() => {
    if (formData.deliveryType === 'pickup') {
      setDeliveryCalc(null);
    }
  }, [formData.deliveryType]);

  // Handle Stripe payment redirect feedback and create LexOffice invoice for paid orders
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const orderNum = urlParams.get('order');
    
    if (paymentStatus === 'success' && orderNum) {
      toast.success(
        language === 'de' 
          ? `Zahlung erfolgreich! Bestellung #${orderNum} wurde bezahlt.`
          : `Payment successful! Order #${orderNum} has been paid.`
      );
      
      // Create LexOffice invoice for the paid order
      const createInvoiceForPaidOrder = async () => {
        try {
          // Try to read from localStorage first (for anonymous users who can't SELECT due to RLS)
          const cachedOrderKey = `stripe_order_${orderNum}`;
          const cachedOrder = localStorage.getItem(cachedOrderKey);
          
          let orderPayload;
          
          if (cachedOrder) {
            // Use cached data from localStorage
            orderPayload = JSON.parse(cachedOrder);
            // Clean up localStorage after use
            localStorage.removeItem(cachedOrderKey);
            console.log('Using cached order data for LexOffice invoice');
          } else {
            // Fallback: Try to fetch from database (works for logged-in users)
            const { data: orderData, error: fetchError } = await supabase
              .from('catering_orders')
              .select('*')
              .eq('order_number', orderNum)
              .single();
            
            if (fetchError || !orderData) {
              console.error('Failed to fetch order for invoice:', fetchError);
              return;
            }

            orderPayload = {
              orderId: orderData.id,
              orderNumber: orderNum,
              customerName: orderData.customer_name,
              customerEmail: orderData.customer_email,
              customerPhone: orderData.customer_phone,
              companyName: orderData.company_name || undefined,
              billingAddress: {
                name: orderData.billing_name || orderData.customer_name,
                street: orderData.billing_street || '',
                zip: orderData.billing_zip || '',
                city: orderData.billing_city || '',
                country: orderData.billing_country || 'Deutschland'
              },
              items: orderData.items as { id: string; name: string; name_en?: string; quantity: number; price: number }[],
              subtotal: orderData.total_amount - (orderData.delivery_cost || 0) - (orderData.minimum_order_surcharge || 0),
              deliveryCost: orderData.delivery_cost || 0,
              minimumOrderSurcharge: orderData.minimum_order_surcharge || 0,
              distanceKm: orderData.calculated_distance_km || undefined,
              grandTotal: orderData.total_amount,
              isPickup: orderData.is_pickup || false
            };
          }

          // Create LexOffice invoice (Rechnung) since payment was successful
          const invoiceResponse = await supabase.functions.invoke('create-lexoffice-invoice', {
            body: {
              ...orderPayload,
              documentType: 'invoice', // Rechnung weil bezahlt
              isPaid: true
            }
          });
          
          if (invoiceResponse.error) {
            console.warn('Lexoffice invoice creation failed:', invoiceResponse.error);
          } else {
            console.log('Lexoffice invoice created for paid order:', invoiceResponse.data?.documentId);
          }
        } catch (err) {
          console.error('Error creating invoice for paid order:', err);
        }
      };

      createInvoiceForPaidOrder();
      
      // Clear URL params
      window.history.replaceState({}, '', '/checkout');
    } else if (paymentStatus === 'cancelled') {
      toast.error(
        language === 'de'
          ? 'Zahlung abgebrochen. Bitte versuchen Sie es erneut.'
          : 'Payment cancelled. Please try again.'
      );
      window.history.replaceState({}, '', '/checkout');
    }
  }, [language]);

  // Pizza time validation helper
  const isPizzaTimeValid = (time: string): boolean => {
    if (!time) return false;
    const [hours, minutes] = time.split(':').map(Number);
    const timeValue = hours * 60 + minutes;
    
    const lunch = { start: 12 * 60, end: 14 * 60 + 30 }; // 12:00-14:30
    const dinner = { start: 18 * 60, end: 22 * 60 + 30 }; // 18:00-22:30
    
    return (timeValue >= lunch.start && timeValue <= lunch.end) ||
           (timeValue >= dinner.start && timeValue <= dinner.end);
  };

  // Validate date/time: Pizza (same-day OK, but must be in time slots) vs Catering (24h advance)
  useEffect(() => {
    if (!formData.date || !formData.time) {
      setDateTimeWarning(null);
      return;
    }
    
    const phoneText = isMobile 
      ? '<a href="tel:01636033912" class="underline font-medium hover:text-amber-800 dark:hover:text-amber-200">0163 6033912</a>'
      : '0163 6033912';
    
    if (isPizzaOnly) {
      // Pizza: No 24h advance required, but must be within delivery time slots
      if (!isPizzaTimeValid(formData.time)) {
        setDateTimeWarning(
          language === 'de'
            ? 'Pizza-Lieferung ist nur zwischen 12:00-14:30 Uhr und 18:00-22:30 Uhr möglich (Mo-So).'
            : 'Pizza delivery is only available between 12:00-14:30 and 18:00-22:30 (Mon-Sun).'
        );
      } else {
        // Check if the selected time is in the past
        const now = new Date();
        const selectedDateTime = new Date(`${formData.date}T${formData.time}`);
        const minPizzaTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour lead time
        
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
      // Catering: 24h advance required, any time allowed
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
  }, [formData.date, formData.time, language, isMobile, isPizzaOnly]);

  // Calculate minimum order surcharge if needed
  const minimumOrderSurcharge = deliveryCalc && totalPrice < deliveryCalc.minimumOrder 
    ? deliveryCalc.minimumOrder - totalPrice 
    : 0;
  
  // VAT calculations
  // Food items: 7% VAT (prices in DB are gross/brutto)
  const foodGross = totalPrice + minimumOrderSurcharge;
  const foodNet = foodGross / 1.07;
  const foodVat = foodGross - foodNet;
  
  // Delivery: 19% VAT (from edge function)
  const deliveryNet = deliveryCalc?.deliveryCostNet || 0;
  const deliveryGross = deliveryCalc?.deliveryCostGross || 0;
  const deliveryVat = deliveryCalc?.deliveryVat || 0;
  
  // Totals
  const totalNet = foodNet + deliveryNet;
  const totalVat7 = foodVat;
  const totalVat19 = deliveryVat;
  const grandTotal = foodGross + deliveryGross;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const sequence = Math.floor(Date.now() / 1000) % 1000 + 100;
    return `EVENTS-ANGEBOT-${day}-${month}-${year}-${sequence}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      toast.error(language === 'de' ? 'Warenkorb ist leer' : 'Cart is empty');
      return;
    }

    // Validate email before submit
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.valid) {
      const errorMsg = emailValidation.error?.split('|').find(s => s.startsWith(language === 'de' ? 'de:' : 'en:'));
      setEmailError(errorMsg ? errorMsg.slice(3) : emailValidation.error || 'Invalid email');
      toast.error(language === 'de' ? 'Bitte prüfen Sie die E-Mail-Adresse' : 'Please check your email address');
      return;
    }

    // Validate date and time (required fields)
    if (!formData.date || !formData.time) {
      toast.error(
        language === 'de' 
          ? 'Bitte wählen Sie Datum und Uhrzeit für die Lieferung/Abholung' 
          : 'Please select a date and time for delivery/pickup'
      );
      return;
    }

    setIsSubmitting(true);
    const newOrderNumber = generateOrderNumber();

    // User ID for linking (existing user only, no account creation during checkout)
    const existingUserId = user?.id || null;

    // Build notes with service options
    let fullNotes = formData.notes || '';
    if (formData.wantsSetupService) {
      fullNotes += (fullNotes ? '\n\n' : '') + '📦 Aufbau & Service gewünscht';
    }

    // Determine billing address
    const needsBillingAddress = formData.deliveryType === 'pickup' 
      ? formData.showBillingAddress 
      : !formData.sameAsDelivery;
    
    const billingAddress = !needsBillingAddress && formData.deliveryType === 'delivery'
      ? {
          name: formData.company || formData.name,
          street: formData.deliveryStreet,
          zip: formData.deliveryZip,
          city: formData.deliveryCity,
          country: 'Deutschland'
        }
      : {
          name: formData.billingName,
          street: formData.billingStreet,
          zip: formData.billingZip,
          city: formData.billingCity,
          country: formData.billingCountry
        };

    try {
      // Generate order ID client-side to avoid RLS SELECT issues
      const orderId = crypto.randomUUID();
      
      // Insert order without returning (RLS allows INSERT but not SELECT for anon)
      const { error } = await supabase
        .from('catering_orders')
        .insert({
          id: orderId,
          order_number: newOrderNumber,
          customer_name: formData.name,
          customer_email: formData.email,
          customer_phone: formData.phone,
          company_name: formData.company || null,
          // Structured delivery address
          delivery_street: formData.deliveryType === 'delivery' ? formData.deliveryStreet : null,
          delivery_zip: formData.deliveryType === 'delivery' ? formData.deliveryZip : null,
          delivery_city: formData.deliveryType === 'delivery' ? formData.deliveryCity : null,
          delivery_floor: formData.deliveryType === 'delivery' && formData.deliveryFloor ? formData.deliveryFloor : null,
          has_elevator: formData.deliveryType === 'delivery' ? formData.hasElevator : false,
          // Composite address for backward compatibility
          delivery_address: formData.deliveryType === 'delivery' ? fullDeliveryAddress : null,
          is_pickup: formData.deliveryType === 'pickup',
          desired_date: formData.date || null,
          desired_time: formData.time || null,
          notes: fullNotes || null,
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            name_en: item.name_en,
            quantity: item.quantity,
            price: item.price
          })),
          total_amount: grandTotal,
          billing_name: billingAddress.name || null,
          billing_street: billingAddress.street || null,
          billing_zip: billingAddress.zip || null,
          billing_city: billingAddress.city || null,
          billing_country: billingAddress.country || null,
          delivery_cost: deliveryCalc?.deliveryCostGross || 0,
          minimum_order_surcharge: minimumOrderSurcharge,
          calculated_distance_km: deliveryCalc?.distanceKm || null,
          // Payment tracking
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'stripe' ? 'pending' : 'pending',
          // Link to customer account if logged in
          user_id: existingUserId
        });

      if (error) throw error;

      // Send email notifications
      try {
        const emailResponse = await supabase.functions.invoke('send-order-notification', {
          body: {
            orderNumber: newOrderNumber,
            customerName: formData.name,
            customerEmail: formData.email,
            customerPhone: formData.phone,
            companyName: formData.company || undefined,
            deliveryAddress: formData.deliveryType === 'delivery' ? fullDeliveryAddress : undefined,
            isPickup: formData.deliveryType === 'pickup',
            desiredDate: formData.date || undefined,
            desiredTime: formData.time || undefined,
            notes: fullNotes || undefined,
            items: items.map(item => ({
              id: item.id,
              name: item.name,
              name_en: item.name_en,
              quantity: item.quantity,
              price: item.price
            })),
            subtotal: totalPrice,
            deliveryCost: deliveryCalc?.deliveryCostGross || 0,
            deliveryCostNet: deliveryCalc?.deliveryCostNet || 0,
            deliveryVat: deliveryCalc?.deliveryVat || 0,
            minimumOrderSurcharge: minimumOrderSurcharge,
            distanceKm: deliveryCalc?.distanceKm || undefined,
            grandTotal: grandTotal,
            billingAddress: needsBillingAddress ? billingAddress : undefined
          }
        });
        
        if (emailResponse.error) {
          console.error('Email notification error:', emailResponse.error);
        }
      } catch (emailError) {
        console.error('Email notification error:', emailError);
      }

      // Create Lexoffice document:
      // - For invoice payment: Create QUOTATION (Angebot) immediately
      // - For Stripe payment: Invoice (Rechnung) will be created after successful payment
      if (paymentMethod === 'invoice') {
        try {
          const invoiceResponse = await supabase.functions.invoke('create-lexoffice-invoice', {
            body: {
              orderId: orderId,
              orderNumber: newOrderNumber,
              customerName: formData.name,
              customerEmail: formData.email,
              customerPhone: formData.phone,
              companyName: formData.company || undefined,
              billingAddress: billingAddress,
              items: items.map(item => ({
                id: item.id,
                name: item.name,
                name_en: item.name_en,
                quantity: item.quantity,
                price: item.price
              })),
              subtotal: totalPrice,
              deliveryCost: deliveryCalc?.deliveryCostGross || 0,
              deliveryCostNet: deliveryCalc?.deliveryCostNet || 0,
              deliveryVat: deliveryCalc?.deliveryVat || 0,
              minimumOrderSurcharge: minimumOrderSurcharge,
              distanceKm: deliveryCalc?.distanceKm || undefined,
              grandTotal: grandTotal,
              isPickup: formData.deliveryType === 'pickup',
              documentType: 'quotation', // Angebot für unbezahlte Bestellungen
              isPaid: false,
              // NEW: Additional order details
              desiredDate: formData.date || undefined,
              desiredTime: formData.time || undefined,
              deliveryAddress: formData.deliveryType === 'delivery' ? fullDeliveryAddress : undefined,
              notes: fullNotes || undefined,
              paymentMethod: paymentMethod
            }
          });
          
          if (invoiceResponse.error) {
            console.warn('Lexoffice quotation creation failed:', invoiceResponse.error);
          } else if (invoiceResponse.data?.skipped) {
            console.log('Lexoffice quotation skipped:', invoiceResponse.data.reason);
          } else {
            console.log('Lexoffice quotation created:', invoiceResponse.data?.documentId);
            // Use the new order number from LexOffice response
            if (invoiceResponse.data?.orderNumber) {
              setOrderNumber(invoiceResponse.data.orderNumber);
            }
          }
        } catch (invoiceError) {
          console.warn('Lexoffice quotation error:', invoiceError);
        }
      }
      // Note: For Stripe payments, the invoice will be created after payment success (see useEffect above)

      setOrderNumber(newOrderNumber);
      
      // If Stripe payment selected, redirect to payment
      if (paymentMethod === 'stripe') {
        setIsProcessingPayment(true);
        
        // Cache order data in localStorage for LexOffice invoice after payment
        // (needed because anonymous users can't SELECT from catering_orders due to RLS)
        const cachedOrderKey = `stripe_order_${newOrderNumber}`;
        const orderDataForCache = {
          orderId: orderId,
          orderNumber: newOrderNumber,
          customerName: formData.name,
          customerEmail: formData.email,
          customerPhone: formData.phone,
          companyName: formData.company || undefined,
          billingAddress: billingAddress,
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            name_en: item.name_en,
            quantity: item.quantity,
            price: item.price
          })),
          subtotal: totalPrice,
          deliveryCost: deliveryCalc?.deliveryCostGross || 0,
          minimumOrderSurcharge: minimumOrderSurcharge,
          distanceKm: deliveryCalc?.distanceKm || undefined,
          grandTotal: grandTotal,
          isPickup: formData.deliveryType === 'pickup',
          // NEW: Additional order details for LexOffice invoice after payment
          desiredDate: formData.date || undefined,
          desiredTime: formData.time || undefined,
          deliveryAddress: formData.deliveryType === 'delivery' ? fullDeliveryAddress : undefined,
          notes: fullNotes || undefined,
          paymentMethod: 'stripe' as const
        };
        localStorage.setItem(cachedOrderKey, JSON.stringify(orderDataForCache));
        
        try {
          const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
            'create-catering-payment',
            {
              body: {
                amount: grandTotal,
                customerEmail: formData.email,
                customerName: formData.name,
                orderNumber: newOrderNumber,
                items: items.map(i => ({ name: i.name, quantity: i.quantity })),
              },
            }
          );

          if (paymentError || !paymentData?.url) {
            console.error('Payment error:', paymentError);
            toast.error(language === 'de' ? 'Fehler bei der Zahlungsweiterleitung' : 'Payment redirect error');
            setIsProcessingPayment(false);
            localStorage.removeItem(cachedOrderKey); // Clean up on error
            // Still navigate to success since order was created
            clearCart();
            navigate('/kunde/registrieren', { 
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
                    ? `${formData.deliveryStreet}, ${formData.deliveryZip} ${formData.deliveryCity}${formData.deliveryFloor ? ` (${formData.deliveryFloor}${formData.hasElevator ? ', Aufzug' : ''})` : ''}`
                    : null,
                  date: formData.date,
                  time: formData.time,
                  subtotal: totalPrice,
                  deliveryCost: deliveryCalc?.deliveryCostGross || 0,
                  grandTotal: grandTotal,
                  paymentMethod: paymentMethod,
                  company: formData.company
                }
              },
              replace: true
            });
            return;
          }

          // Redirect to Stripe Checkout - use direct assignment with fallback
          clearCart();
          
          // Try immediate redirect
          try {
            window.location.assign(paymentData.url);
          } catch {
            // Fallback: open in same tab
            window.open(paymentData.url, '_self');
          }
          return;
        } catch (payErr) {
          console.error('Payment error:', payErr);
          toast.error(language === 'de' ? 'Fehler bei der Zahlung' : 'Payment error');
          setIsProcessingPayment(false);
          localStorage.removeItem(cachedOrderKey); // Clean up on error
          // Still navigate to success since order was created
          clearCart();
          navigate('/kunde/registrieren', { 
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
                  ? `${formData.deliveryStreet}, ${formData.deliveryZip} ${formData.deliveryCity}${formData.deliveryFloor ? ` (${formData.deliveryFloor}${formData.hasElevator ? ', Aufzug' : ''})` : ''}`
                  : null,
                date: formData.date,
                time: formData.time,
                subtotal: totalPrice,
                deliveryCost: deliveryCalc?.deliveryCostGross || 0,
                grandTotal: grandTotal,
                paymentMethod: paymentMethod,
                company: formData.company
              }
            },
            replace: true
          });
          return;
        }
      }
      
      // Navigate directly to success page
      clearCart();
      navigate('/kunde/registrieren', { 
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
              ? `${formData.deliveryStreet}, ${formData.deliveryZip} ${formData.deliveryCity}${formData.deliveryFloor ? ` (${formData.deliveryFloor}${formData.hasElevator ? ', Aufzug' : ''})` : ''}`
              : null,
            date: formData.date,
            time: formData.time,
            subtotal: totalPrice,
            deliveryCost: deliveryCalc?.deliveryCostGross || 0,
            grandTotal: grandTotal,
            paymentMethod: paymentMethod,
            company: formData.company
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
        />
        <div className="min-h-screen bg-background flex flex-col">
          <Header />
          <Navigation />
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

  // Cart Summary Component (used in sticky sidebar on desktop)
  const CartSummary = ({ showItems = false }: { showItems?: boolean }) => (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 lg:min-h-[380px]">
      <h2 className="font-serif text-lg flex items-center gap-2">
        {language === 'de' ? 'Ihre Bestellung' : 'Your Order'}
      </h2>
      
      {showItems && (
        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
          {items.map((item) => {
            const name = language === 'en' && item.name_en ? item.name_en : item.name;
            return (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                {item.image && (
                  <img src={item.image} alt={name} className="w-14 h-14 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity}× {formatPrice(item.price)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-6 text-center text-xs">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromCart(item.id)}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Pricing Summary with VAT breakdown */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">{language === 'de' ? 'Zwischensumme' : 'Subtotal'}</span>
          <span>{formatPrice(totalPrice)}</span>
        </div>
        {minimumOrderSurcharge > 0 && (
          <div className="flex justify-between items-center text-sm text-amber-600 dark:text-amber-400">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              {language === 'de' ? 'Mindestbest.-Aufschlag' : 'Min. order surcharge'}
            </span>
            <span>+{formatPrice(minimumOrderSurcharge)}</span>
          </div>
        )}
        {formData.deliveryType === 'delivery' && deliveryCalc && (
          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {language === 'de' ? 'Lieferung' : 'Delivery'}
                {deliveryCalc.isRoundTrip && deliveryCalc.oneWayDistanceKm > 25 && (
                  <span className="text-xs block text-muted-foreground/70">
                    ({deliveryCalc.oneWayDistanceKm} km × 2)
                  </span>
                )}
              </span>
              <span>
                {deliveryCalc.isFreeDelivery 
                  ? (language === 'de' ? 'Kostenlos' : 'Free')
                  : formatPrice(deliveryCalc.deliveryCostGross, 0.19)}
              </span>
            </div>
          </div>
        )}
        {formData.deliveryType === 'pickup' && (
          <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400">
            <span>{language === 'de' ? 'Lieferung' : 'Delivery'}</span>
            <span>{language === 'de' ? 'Abholung – 0,00 €' : 'Pickup – €0.00'}</span>
          </div>
        )}
        
        {/* VAT Breakdown - separate 7% for food and 19% for delivery */}
        <div className="pt-2 mt-2 border-t border-dashed border-border space-y-1">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{language === 'de' ? 'Nettobetrag' : 'Net amount'}</span>
            <span>{totalNet.toFixed(2).replace('.', ',')} €</span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>{language === 'de' ? '+ 7% MwSt. (Speisen)' : '+ 7% VAT (food)'}</span>
            <span>{totalVat7.toFixed(2).replace('.', ',')} €</span>
          </div>
          {totalVat19 > 0 && (
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{language === 'de' ? '+ 19% MwSt. (Lieferung)' : '+ 19% VAT (delivery)'}</span>
              <span>{totalVat19.toFixed(2).replace('.', ',')} €</span>
            </div>
          )}
        </div>
        
        <div className="flex justify-between items-center pt-3 border-t border-border">
          <span className="font-semibold">
            {language === 'de' 
              ? `Gesamtbetrag (${showGross ? 'brutto' : 'netto'})`
              : `Total (${showGross ? 'gross' : 'net'})`}
          </span>
          <span className="text-xl font-bold text-primary">
            {showGross 
              ? formatPrice(grandTotal)
              : formatPrice(totalNet, 0)}
          </span>
        </div>
      </div>

      {/* CTA Button */}
      <Button 
        type="submit" 
        size="lg" 
        className="w-full text-base py-6 font-semibold shadow-lg hover:shadow-xl transition-all"
        disabled={isSubmitting || isProcessingPayment}
      >
        {(isSubmitting || isProcessingPayment)
          ? (language === 'de' ? 'Wird verarbeitet...' : 'Processing...')
          : paymentMethod === 'stripe'
            ? (language === 'de' 
                ? `Jetzt bezahlen · ${showGross ? formatPrice(grandTotal) : formatPrice(totalNet, 0)}`
                : `Pay Now · ${showGross ? formatPrice(grandTotal) : formatPrice(totalNet, 0)}`)
            : (language === 'de' 
                ? `Jetzt bestellen · ${showGross ? formatPrice(grandTotal) : formatPrice(totalNet, 0)}`
                : `Order Now · ${showGross ? formatPrice(grandTotal) : formatPrice(totalNet, 0)}`)}
      </Button>

      {/* Trust Elements */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{language === 'de' ? 'Sichere Übertragung' : 'Secure transmission'}</span>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          {paymentMethod === 'stripe'
            ? (language === 'de' 
                ? 'Weiterleitung zu Stripe für sichere Zahlung'
                : 'Redirect to Stripe for secure payment')
            : (language === 'de' 
                ? 'Verbindliche Bestellung – Zahlung per Rechnung'
                : 'Binding order – payment by invoice')}
        </p>
        
        {/* Trust Bar with Payment Logos */}
        <div className="flex items-center justify-center gap-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <svg viewBox="0 0 24 24" className="h-6 w-auto" fill="currentColor"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm0 2v2h16V6H4zm0 6v6h16v-6H4zm2 2h4v2H6v-2zm6 0h2v2h-2v-2z"/></svg>
            <svg viewBox="0 0 24 24" className="h-5 w-auto" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
          <span className="text-[10px] text-muted-foreground/70 tracking-wide uppercase">
            {language === 'de' ? '100+ erfolgreiche Caterings' : '100+ successful caterings'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Bestellung aufgeben | STORIA' : 'Place Order | STORIA'}
        description=""
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1 container mx-auto px-4 py-6 md:py-10 pb-32 lg:pb-10">
          <div className="max-w-6xl mx-auto">
            {/* Progress Steps */}
            <ProgressSteps currentStep={currentStep} className="mb-6 max-w-md mx-auto" />
            
            <h1 className="text-2xl md:text-3xl font-serif font-medium mb-4 text-center lg:col-span-full">
              {language === 'de' ? 'Bestellung aufgeben' : 'Place Your Order'}
            </h1>
            
            {/* Motivational Text */}
            <p className="text-center text-muted-foreground mb-6">
              <PartyPopper className="inline h-4 w-4 mr-1" />
              {language === 'de' 
                ? 'Fast geschafft – nur noch wenige Angaben!' 
                : 'Almost done – just a few more details!'}
            </p>

            <form onSubmit={handleSubmit}>
              {/* Two-Column Layout: Form left, Sticky Cart right on desktop */}
              <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 items-start">
                
                {/* Left Column: Form Sections */}
                <div className="space-y-6">
                  
                  {/* Mobile Cart Overview (hidden on desktop) */}
                  <section className="lg:hidden bg-card border border-border rounded-xl p-4">
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <span className="font-serif text-lg">{language === 'de' ? 'Ihre Auswahl' : 'Your Selection'} ({items.length})</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{showGross ? formatPrice(grandTotal) : formatPrice(totalNet, 0)}</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="space-y-3">
                          {items.map((item) => {
                            const name = language === 'en' && item.name_en ? item.name_en : item.name;
                            return (
                              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                                {item.image && (
                                  <img src={item.image} alt={name} className="w-14 h-14 rounded-lg object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{name}</p>
                                  <p className="text-xs text-muted-foreground">{item.quantity}× {formatPrice(item.price)}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-6 text-center text-xs">{item.quantity}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    className="w-6 h-6 rounded-full border border-border flex items-center justify-center hover:bg-muted"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(item.id)}
                                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </section>

                  {/* Section 1: Contact Details */}
                  <section className="bg-card border border-border rounded-xl p-4 md:p-6">
                    <h2 className="font-serif text-lg mb-4 flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      {language === 'de' ? 'Kontaktdaten' : 'Contact Details'}
                    </h2>
                    
                    {/* Login hint for guests */}
                    {!user && (
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border/50">
                        <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          <LogIn className="h-4 w-4" />
                          {language === 'de' 
                            ? 'Haben Sie ein Konto? ' 
                            : 'Have an account? '}
                          <Link to="/konto/login?redirect=/checkout" className="text-primary hover:underline font-medium">
                            {language === 'de' ? 'Anmelden' : 'Log in'}
                          </Link>
                          {language === 'de' 
                            ? ' für schnelleres Bestellen.' 
                            : ' for faster checkout.'}
                        </p>
                      </div>
                    )}
                    
                    {/* Logged in indicator */}
                    {user && (
                      <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <p className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          {language === 'de' 
                            ? `Angemeldet als ${profile?.name || user.email}` 
                            : `Logged in as ${profile?.name || user.email}`}
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">{language === 'de' ? 'Name' : 'Name'} *</Label>
                        <Input
                          id="name"
                          name="name"
                          autoComplete="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          className="mt-1"
                        />
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
                          className={`mt-1 ${emailError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        />
                        {emailError && (
                          <p className="text-sm text-destructive mt-1">{emailError}</p>
                        )}
                        {/* Newsletter Signup */}
                        <div className="flex items-start gap-2 mt-3">
                          <Checkbox
                            id="newsletter"
                            checked={newsletterSignup}
                            onCheckedChange={(checked) => setNewsletterSignup(checked as boolean)}
                          />
                          <Label htmlFor="newsletter" className="text-sm text-muted-foreground cursor-pointer leading-tight">
                            {language === 'de' 
                              ? 'Ja, ich möchte den STORIA Newsletter erhalten und über Angebote und Neuigkeiten informiert werden.'
                              : 'Yes, I want to receive the STORIA newsletter and be informed about offers and news.'}
                          </Label>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="phone">{language === 'de' ? 'Telefon' : 'Phone'} *</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          value={formData.phone}
                          onChange={handleInputChange}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="company">{language === 'de' ? 'Firma (optional)' : 'Company (optional)'}</Label>
                        <Input
                          id="company"
                          name="company"
                          autoComplete="organization"
                          value={formData.company}
                          onChange={handleInputChange}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    
                  </section>

                  {/* Section 2: Payment Method (MOVED UP) */}
                  <section className="bg-card border border-border rounded-xl p-4 md:p-6 ring-2 ring-primary/20">
                    <h2 className="font-serif text-lg mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      {language === 'de' ? 'Zahlungsart' : 'Payment Method'}
                    </h2>
                    <div className="space-y-3">
                      {/* Stripe - Primary Option */}
                      <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-accent/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 relative">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="stripe"
                          checked={paymentMethod === 'stripe'}
                          onChange={() => setPaymentMethod('stripe')}
                          className="h-4 w-4 text-primary"
                        />
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{language === 'de' ? 'Sofort bezahlen' : 'Pay Now'}</p>
                          <p className="text-sm text-muted-foreground">
                            {language === 'de' 
                              ? 'Kreditkarte, Apple Pay, Google Pay' 
                              : 'Credit card, Apple Pay, Google Pay'}
                          </p>
                        </div>
                        <span className="absolute top-2 right-2 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                          {language === 'de' ? 'Beliebt' : 'Popular'}
                        </span>
                      </label>
                      
                      {/* Stripe Trust Notice */}
                      {paymentMethod === 'stripe' && (
                        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                          <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                          <p className="text-sm text-green-700 dark:text-green-300">
                            {language === 'de' 
                              ? 'Sichere Zahlung per Stripe – Ihre Daten bleiben geschützt. Wir speichern keine Zahlungsinformationen.'
                              : 'Secure payment via Stripe – Your data stays protected. We do not store payment information.'}
                          </p>
                        </div>
                      )}
                      
                      {/* Invoice Option */}
                      <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value="invoice"
                          checked={paymentMethod === 'invoice'}
                          onChange={() => setPaymentMethod('invoice')}
                          className="h-4 w-4 text-primary"
                        />
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{language === 'de' ? 'Rechnung' : 'Invoice'}</p>
                          <p className="text-sm text-muted-foreground">
                            {language === 'de' 
                              ? 'Zahlung nach Erhalt der Rechnung' 
                              : 'Payment after receiving invoice'}
                          </p>
                        </div>
                      </label>
                    </div>
                    {/* Payment Logos */}
                    <PaymentLogos className="mt-4 pt-4 border-t border-border" />
                  </section>

                  {/* Section 3: Delivery/Pickup + Date/Time (Combined) */}
                  <section className="bg-card border border-border rounded-xl p-4 md:p-6">
                    <h2 className="font-serif text-lg mb-4 flex items-center gap-2">
                      <Truck className="h-5 w-5 text-primary" />
                      {language === 'de' ? 'Lieferung & Termin' : 'Delivery & Schedule'}
                    </h2>

                    {/* Delivery Type Selection */}
                    <RadioGroup
                      value={formData.deliveryType}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, deliveryType: value }))}
                      className="mb-5"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <label 
                          htmlFor="delivery" 
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.deliveryType === 'delivery' 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-muted-foreground/50'
                          }`}
                        >
                          <RadioGroupItem value="delivery" id="delivery" />
                          <div>
                            <span className="font-medium block">{language === 'de' ? 'Lieferung' : 'Delivery'}</span>
                            <span className="text-xs text-muted-foreground">{language === 'de' ? 'Wir liefern zu Ihnen' : 'We deliver to you'}</span>
                          </div>
                        </label>
                        <label 
                          htmlFor="pickup" 
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.deliveryType === 'pickup' 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-muted-foreground/50'
                          }`}
                        >
                          <RadioGroupItem value="pickup" id="pickup" />
                          <div>
                            <span className="font-medium block">{language === 'de' ? 'Abholung' : 'Pickup'}</span>
                            <span className="text-xs text-muted-foreground">Karlstr. 47a, München</span>
                          </div>
                        </label>
                      </div>
                    </RadioGroup>

                    {/* Delivery Address */}
                    {formData.deliveryType === 'delivery' && (
                      <>
                        <div className="space-y-4 mb-4">
                          <Label className="flex items-center gap-1 mb-2">
                            <MapPin className="h-4 w-4" />
                            {language === 'de' ? 'Lieferadresse' : 'Delivery Address'}
                          </Label>
                          
                          {/* Street + Number */}
                          <div>
                            <Label htmlFor="deliveryStreet" className="text-sm">
                              {language === 'de' ? 'Straße + Hausnummer' : 'Street + Number'} *
                            </Label>
                            <Input
                              id="deliveryStreet"
                              name="deliveryStreet"
                              value={formData.deliveryStreet}
                              onChange={handleInputChange}
                              required={formData.deliveryType === 'delivery'}
                              placeholder={language === 'de' ? 'z.B. Karlstraße 47a' : 'e.g. Karlstrasse 47a'}
                              className="mt-1"
                            />
                          </div>
                          
                          {/* ZIP + City */}
                          <div className="grid grid-cols-[100px_1fr] gap-3">
                            <div>
                              <Label htmlFor="deliveryZip" className="text-sm">
                                {language === 'de' ? 'PLZ' : 'ZIP'} *
                              </Label>
                              <Input
                                id="deliveryZip"
                                name="deliveryZip"
                                value={formData.deliveryZip}
                                onChange={handleInputChange}
                                required={formData.deliveryType === 'delivery'}
                                placeholder="80333"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="deliveryCity" className="text-sm">
                                {language === 'de' ? 'Ort' : 'City'} *
                              </Label>
                              <Input
                                id="deliveryCity"
                                name="deliveryCity"
                                value={formData.deliveryCity}
                                onChange={handleInputChange}
                                required={formData.deliveryType === 'delivery'}
                                placeholder="München"
                                className="mt-1"
                              />
                            </div>
                          </div>
                          
                          {/* Floor + Elevator */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="deliveryFloor" className="text-sm">
                                {language === 'de' ? 'Stockwerk' : 'Floor'} <span className="text-muted-foreground text-xs">({language === 'de' ? 'optional' : 'optional'})</span>
                              </Label>
                              <Input
                                id="deliveryFloor"
                                name="deliveryFloor"
                                value={formData.deliveryFloor}
                                onChange={handleInputChange}
                                placeholder={language === 'de' ? 'z.B. 3. OG' : 'e.g. 3rd floor'}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex items-end pb-2">
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id="hasElevator"
                                  checked={formData.hasElevator}
                                  onCheckedChange={(checked) => 
                                    setFormData(prev => ({ ...prev, hasElevator: checked as boolean }))
                                  }
                                />
                                <Label htmlFor="hasElevator" className="cursor-pointer text-sm">
                                  {language === 'de' ? 'Aufzug vorhanden' : 'Elevator available'}
                                </Label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Delivery Calculation Result */}
                        {isCalculating && (
                          <div className="bg-muted/50 rounded-lg p-4 mb-4 flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">
                              {language === 'de' ? 'Berechne Lieferentfernung...' : 'Calculating delivery distance...'}
                            </span>
                          </div>
                        )}

                        {deliveryCalc && !isCalculating && (
                          <div className="rounded-lg p-4 mb-4 border bg-muted/50 border-border">
                            <div className="flex items-start gap-3">
                              <Truck className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {language === 'de' ? deliveryCalc.message : deliveryCalc.messageEn}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {deliveryCalc.isRoundTrip ? (
                                        language === 'de' 
                                          ? `${deliveryCalc.oneWayDistanceKm} km × 2 Fahrten (Hin + Rück)`
                                          : `${deliveryCalc.oneWayDistanceKm} km × 2 trips (there & back)`
                                      ) : (
                                        language === 'de' 
                                          ? `Entfernung: ${deliveryCalc.distanceKm} km`
                                          : `Distance: ${deliveryCalc.distanceKm} km`
                                      )}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    {deliveryCalc.isFreeDelivery ? (
                                      <span className="text-lg font-bold text-primary">
                                        {language === 'de' ? 'Kostenlos' : 'Free'}
                                      </span>
                                    ) : (
                                      <div className="text-right">
                                        <span className="text-lg font-bold text-foreground">
                                          {deliveryCalc.deliveryCostGross.toFixed(2).replace('.', ',')} €
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                          {language === 'de' 
                                            ? `(${deliveryCalc.deliveryCostNet.toFixed(2).replace('.', ',')} € netto)`
                                            : `(€${deliveryCalc.deliveryCostNet.toFixed(2)} net)`}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Round trip explanation */}
                                {deliveryCalc.isRoundTrip && (
                                  <p className="text-xs text-muted-foreground mb-2 italic">
                                    {language === 'de' 
                                      ? 'Hin- und Rückfahrt für Equipment-Abholung (Geschirr, Wärmebehälter etc.)'
                                      : 'Round trip for equipment pickup (dishes, warming containers etc.)'}
                                  </p>
                                )}
                                
                                {/* Pizza only - no round trip */}
                                {!deliveryCalc.isRoundTrip && !deliveryCalc.isFreeDelivery && deliveryCalc.oneWayDistanceKm > 25 && (
                                  <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                                    {language === 'de' 
                                      ? '✓ Nur Hinfahrt – Einwegverpackung, keine Rückfahrt nötig'
                                      : '✓ One-way only – disposable packaging, no return trip needed'}
                                  </p>
                                )}
                                
                                {minimumOrderSurcharge > 0 && (
                                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                    {language === 'de' 
                                      ? `Aufschlag von ${minimumOrderSurcharge.toFixed(2).replace('.', ',')} € wird hinzugefügt, um Mindestbestellwert von ${deliveryCalc.minimumOrder} € zu erreichen.`
                                      : `A surcharge of €${minimumOrderSurcharge.toFixed(2)} will be added to meet the minimum order of €${deliveryCalc.minimumOrder}.`}
                                  </p>
                                )}
                                
                                <p className="text-xs mt-2 text-muted-foreground">
                                  {language === 'de' 
                                    ? 'Speisen inkl. 7% MwSt. · Lieferung zzgl. 19% MwSt.' 
                                    : 'Food incl. 7% VAT · Delivery + 19% VAT'}
                                </p>
                                
                                {/* Waiting time notice */}
                                <p className="text-xs mt-1 text-muted-foreground">
                                  {language === 'de' 
                                    ? 'Wartezeit über 15 Min. bei Anlieferung: 35 €/angefangene Stunde' 
                                    : 'Waiting time over 15 min on delivery: €35/started hour'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {!deliveryCalc && !isCalculating && fullDeliveryAddress.length < 10 && (
                          <div className="bg-muted/50 rounded-lg p-4 mb-4">
                            <div className="flex items-start gap-3">
                              <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="text-sm text-muted-foreground">
                                <p className="mb-2">
                                  {language === 'de' 
                                    ? 'Geben Sie Ihre vollständige Adresse ein, um die Lieferkosten zu berechnen.'
                                    : 'Enter your full address to calculate delivery costs.'}
                                </p>
                                <ul className="space-y-1">
                                  <li>✓ {language === 'de' ? 'Bis 1 km: Kostenlos (Mindestbestellwert 50 €)' : 'Up to 1 km: Free (min. order €50)'}</li>
                                  <li>• {language === 'de' ? '1-25 km München: 2 × 25 € netto (Mindestbestellwert 150 €)' : '1-25 km Munich: 2 × €25 net (min. order €150)'}</li>
                                  <li>• {language === 'de' ? 'Außerhalb: 1,20 €/km netto × 2 Fahrten (Mindestbestellwert 200 €)' : 'Outside: €1.20/km net × 2 trips (min. order €200)'}</li>
                                  <li className="text-xs text-muted-foreground pl-4">
                                    {language === 'de' 
                                      ? '(Bei reinen Pizza-Bestellungen nur einfache Fahrt)'
                                      : '(Pizza-only orders: single trip only)'}
                                  </li>
                                  <li className="text-xs text-muted-foreground pl-4">
                                    {language === 'de' 
                                      ? '(Alle Lieferpreise zzgl. 19% MwSt.)'
                                      : '(All delivery prices + 19% VAT)'}
                                  </li>
                                  <li className="text-xs text-muted-foreground pl-4">
                                    {language === 'de' 
                                      ? '(Wartezeit über 15 Min.: 35 €/angefangene Stunde)'
                                      : '(Waiting time over 15 min: €35/started hour)'}
                                  </li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Pickup Info */}
                    {formData.deliveryType === 'pickup' && (
                      <div className="bg-muted/50 rounded-lg p-4 mb-4">
                        <p className="text-sm font-medium mb-1">
                          {language === 'de' ? 'Abholadresse:' : 'Pickup Address:'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          STORIA – Ristorante & Bar<br />
                          Karlstr. 47a<br />
                          80333 München
                        </p>
                      </div>
                    )}

                    {/* Date and Time - Prominent */}
                    <div className="border-t border-border pt-5 mt-4">
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {language === 'de' ? 'Wann wird Ihr Catering benötigt?' : 'When do you need your catering?'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="date" className="flex items-center gap-1 text-sm">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {language === 'de' ? 'Datum *' : 'Date *'}
                          </Label>
                          <Input
                            id="date"
                            name="date"
                            type="date"
                            value={formData.date}
                            onChange={handleInputChange}
                            className="mt-1"
                            required
                            min={(() => {
                              if (isPizzaOnly) {
                                // Pizza: Today is OK
                                return new Date().toISOString().split('T')[0];
                              } else {
                                // Catering: Minimum tomorrow
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                return tomorrow.toISOString().split('T')[0];
                              }
                            })()}
                          />
                        </div>
                        <div>
                          <Label htmlFor="time" className="flex items-center gap-1 text-sm mb-2">
                            <Clock className="h-3.5 w-3.5" />
                            {language === 'de' ? 'Uhrzeit *' : 'Time *'}
                          </Label>
                          <Input
                            id="time"
                            name="time"
                            type="time"
                            value={formData.time}
                            onChange={handleInputChange}
                            className="mt-1"
                            required
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {isPizzaOnly 
                          ? (language === 'de' 
                              ? '🍕 Pizza-Lieferung täglich 12:00-14:30 & 18:00-22:30 Uhr möglich.'
                              : '🍕 Pizza delivery available daily 12:00-14:30 & 18:00-22:30.')
                          : (language === 'de' 
                              ? 'Catering benötigt mindestens 24 Stunden Vorlauf.'
                              : 'Catering requires at least 24 hours advance notice.')}
                      </p>
                      {dateTimeWarning && (
                        <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <p 
                            className="text-sm text-amber-700 dark:text-amber-300"
                            dangerouslySetInnerHTML={{ __html: dateTimeWarning }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Setup Service Option */}
                    <div className="border-t border-border pt-4 mt-4">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="setupService"
                          checked={formData.wantsSetupService}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, wantsSetupService: checked === true }))
                          }
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label htmlFor="setupService" className="font-medium cursor-pointer">
                            {language === 'de' ? 'Aufbau & Service buchen (optional)' : 'Book Setup & Service (optional)'}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {language === 'de' 
                              ? 'Preis nach Vereinbarung – wir beraten Sie gerne'
                              : 'Price by arrangement – we\'ll be happy to advise you'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Cleaning Info */}
                    <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span>
                        {language === 'de' 
                          ? 'Reinigung ist im Preis aller Platten inklusive'
                          : 'Cleaning is included in the price of all platters'}
                      </span>
                    </div>

                    {/* Equipment Info */}
                    <div className="flex items-start gap-2 mt-3 text-sm text-muted-foreground">
                      <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>
                        {language === 'de' 
                          ? 'Besteck, Stoffservietten und weiteres Zubehör können auf Wunsch gegen Aufpreis hinzugebucht werden.'
                          : 'Cutlery, cloth napkins and additional accessories can be added upon request for an extra charge.'}
                      </span>
                    </div>
                  </section>

                  {/* Section 3: Billing Address (Smart Hidden) */}
                  <section className="bg-card border border-border rounded-xl p-4 md:p-6">
                    <h2 className="font-serif text-lg mb-4">
                      {language === 'de' ? 'Rechnungsadresse' : 'Billing Address'}
                    </h2>
                    
                    {formData.deliveryType === 'delivery' ? (
                      // Delivery: Checkbox "Same as delivery"
                      <>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="sameAsDelivery"
                            checked={formData.sameAsDelivery}
                            onCheckedChange={(checked) => 
                              setFormData(prev => ({ ...prev, sameAsDelivery: checked === true }))
                            }
                          />
                          <Label htmlFor="sameAsDelivery" className="font-normal cursor-pointer">
                            {language === 'de' ? 'Entspricht Lieferadresse' : 'Same as delivery address'}
                          </Label>
                        </div>
                        
                        {!formData.sameAsDelivery && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                            <div className="md:col-span-2">
                              <Label htmlFor="billingName">{language === 'de' ? 'Name / Firma' : 'Name / Company'} *</Label>
                              <Input
                                id="billingName"
                                name="billingName"
                                value={formData.billingName}
                                onChange={handleInputChange}
                                required={!formData.sameAsDelivery}
                                className="mt-1"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="billingStreet">{language === 'de' ? 'Straße und Hausnummer' : 'Street and number'} *</Label>
                              <Input
                                id="billingStreet"
                                name="billingStreet"
                                value={formData.billingStreet}
                                onChange={handleInputChange}
                                required={!formData.sameAsDelivery}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="billingZip">{language === 'de' ? 'PLZ' : 'Postal Code'} *</Label>
                              <Input
                                id="billingZip"
                                name="billingZip"
                                value={formData.billingZip}
                                onChange={handleInputChange}
                                required={!formData.sameAsDelivery}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="billingCity">{language === 'de' ? 'Stadt' : 'City'} *</Label>
                              <Input
                                id="billingCity"
                                name="billingCity"
                                value={formData.billingCity}
                                onChange={handleInputChange}
                                required={!formData.sameAsDelivery}
                                className="mt-1"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <Label htmlFor="billingCountry">{language === 'de' ? 'Land' : 'Country'}</Label>
                              <Input
                                id="billingCountry"
                                name="billingCountry"
                                value={formData.billingCountry}
                                onChange={handleInputChange}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      // Pickup: Expandable "Add billing address"
                      <>
                        <Collapsible 
                          open={formData.showBillingAddress} 
                          onOpenChange={(open) => setFormData(prev => ({ ...prev, showBillingAddress: open }))}
                        >
                          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <ChevronDown className={`h-4 w-4 transition-transform ${formData.showBillingAddress ? 'rotate-180' : ''}`} />
                            {formData.showBillingAddress 
                              ? (language === 'de' ? 'Rechnungsadresse ausblenden' : 'Hide billing address')
                              : (language === 'de' ? 'Abweichende Rechnungsadresse hinzufügen' : 'Add different billing address')
                            }
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                              <div className="md:col-span-2">
                                <Label htmlFor="billingName">{language === 'de' ? 'Name / Firma' : 'Name / Company'} *</Label>
                                <Input
                                  id="billingName"
                                  name="billingName"
                                  value={formData.billingName}
                                  onChange={handleInputChange}
                                  required={formData.showBillingAddress}
                                  className="mt-1"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label htmlFor="billingStreet">{language === 'de' ? 'Straße und Hausnummer' : 'Street and number'} *</Label>
                                <Input
                                  id="billingStreet"
                                  name="billingStreet"
                                  value={formData.billingStreet}
                                  onChange={handleInputChange}
                                  required={formData.showBillingAddress}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="billingZip">{language === 'de' ? 'PLZ' : 'Postal Code'} *</Label>
                                <Input
                                  id="billingZip"
                                  name="billingZip"
                                  value={formData.billingZip}
                                  onChange={handleInputChange}
                                  required={formData.showBillingAddress}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor="billingCity">{language === 'de' ? 'Stadt' : 'City'} *</Label>
                                <Input
                                  id="billingCity"
                                  name="billingCity"
                                  value={formData.billingCity}
                                  onChange={handleInputChange}
                                  required={formData.showBillingAddress}
                                  className="mt-1"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <Label htmlFor="billingCountry">{language === 'de' ? 'Land' : 'Country'}</Label>
                                <Input
                                  id="billingCountry"
                                  name="billingCountry"
                                  value={formData.billingCountry}
                                  onChange={handleInputChange}
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                        
                        {!formData.showBillingAddress && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {language === 'de' 
                              ? 'Keine Angabe? Die Rechnung wird an die Kontaktperson adressiert.'
                              : 'No entry? The invoice will be addressed to the contact person.'}
                          </p>
                        )}
                      </>
                    )}
                  </section>

                  {/* Notes Section (Collapsible) */}
                  <Collapsible defaultOpen={false}>
                    <section className="bg-card border border-border rounded-xl p-4 md:p-6">
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <h2 className="font-serif text-lg">
                          {language === 'de' ? 'Anmerkungen (optional)' : 'Notes (optional)'}
                        </h2>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <Textarea
                          name="notes"
                          value={formData.notes}
                          onChange={handleInputChange}
                          placeholder={language === 'de' 
                            ? 'Besondere Wünsche, Allergien, etc.'
                            : 'Special requests, allergies, etc.'}
                          rows={3}
                        />
                      </CollapsibleContent>
                    </section>
                  </Collapsible>

                  {/* Trust Badges (Desktop) */}
                  <div className="hidden lg:block">
                    <TrustBadges variant="horizontal" />
                  </div>

                </div>

                {/* Right Column: Sticky Cart (Desktop only) */}
                {/* Right Column: Sticky Cart (Desktop only) - mt-0 ensures alignment with first form section */}
                <div className="hidden lg:block lg:sticky lg:top-24 mt-0">
                  <CartSummary showItems={true} />
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
                if (form) {
                  form.requestSubmit();
                }
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
