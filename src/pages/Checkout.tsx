import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Minus, Plus, Trash2, CheckCircle, ArrowLeft, Truck, MapPin, Info, Sparkles, Loader2, CalendarDays, Clock, User, ChevronDown, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DeliveryCalculation {
  distanceKm: number;
  deliveryCost: number;
  isFreeDelivery: boolean;
  minimumOrder: number;
  message: string;
  messageEn: string;
}
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const Checkout = () => {
  const { items, updateQuantity, removeFromCart, totalPrice, clearCart } = useCart();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    deliveryType: 'delivery',
    address: '',
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [deliveryCalc, setDeliveryCalc] = useState<DeliveryCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [addressDebounce, setAddressDebounce] = useState<NodeJS.Timeout | null>(null);

  // Calculate delivery cost when address changes
  const calculateDelivery = useCallback(async (address: string) => {
    if (!address || address.trim().length < 10) {
      setDeliveryCalc(null);
      return;
    }

    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-delivery', {
        body: { address }
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

  // Debounced address change handler
  const handleAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newAddress = e.target.value;
    setFormData(prev => ({ ...prev, address: newAddress }));

    // Clear previous timeout
    if (addressDebounce) {
      clearTimeout(addressDebounce);
    }

    // Set new debounced calculation
    const timeout = setTimeout(() => {
      if (formData.deliveryType === 'delivery') {
        calculateDelivery(newAddress);
      }
    }, 1000);

    setAddressDebounce(timeout);
  };

  // Recalculate when switching to delivery
  useEffect(() => {
    if (formData.deliveryType === 'delivery' && formData.address.length >= 10) {
      calculateDelivery(formData.address);
    } else {
      setDeliveryCalc(null);
    }
  }, [formData.deliveryType]);

  // Calculate minimum order surcharge if needed
  const minimumOrderSurcharge = deliveryCalc && totalPrice < deliveryCalc.minimumOrder 
    ? deliveryCalc.minimumOrder - totalPrice 
    : 0;
  
  // Total with delivery and surcharge
  const grandTotal = totalPrice + (deliveryCalc?.deliveryCost || 0) + minimumOrderSurcharge;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const prefix = 'STO';
    const timestamp = date.getFullYear().toString().slice(-2) + 
                     (date.getMonth() + 1).toString().padStart(2, '0') +
                     date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      toast.error(language === 'de' ? 'Warenkorb ist leer' : 'Cart is empty');
      return;
    }

    setIsSubmitting(true);
    const newOrderNumber = generateOrderNumber();

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
          street: formData.address.split('\n')[0] || formData.address,
          zip: '',
          city: '',
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
      // Insert order and get the ID back
      const { data: orderData, error } = await supabase
        .from('catering_orders')
        .insert({
          order_number: newOrderNumber,
          customer_name: formData.name,
          customer_email: formData.email,
          customer_phone: formData.phone,
          company_name: formData.company || null,
          delivery_address: formData.deliveryType === 'delivery' ? formData.address : null,
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
          delivery_cost: deliveryCalc?.deliveryCost || 0,
          minimum_order_surcharge: minimumOrderSurcharge,
          calculated_distance_km: deliveryCalc?.distanceKm || null
        })
        .select('id')
        .single();

      if (error) throw error;

      const orderId = orderData?.id;

      // Send email notifications
      try {
        const emailResponse = await supabase.functions.invoke('send-order-notification', {
          body: {
            orderNumber: newOrderNumber,
            customerName: formData.name,
            customerEmail: formData.email,
            customerPhone: formData.phone,
            companyName: formData.company || undefined,
            deliveryAddress: formData.deliveryType === 'delivery' ? formData.address : undefined,
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
            deliveryCost: deliveryCalc?.deliveryCost || 0,
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

      // Create Lexoffice invoice (graceful - won't block order if it fails)
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
            deliveryCost: deliveryCalc?.deliveryCost || 0,
            minimumOrderSurcharge: minimumOrderSurcharge,
            distanceKm: deliveryCalc?.distanceKm || undefined,
            grandTotal: grandTotal,
            isPickup: formData.deliveryType === 'pickup'
          }
        });
        
        if (invoiceResponse.error) {
          console.warn('Lexoffice invoice creation failed:', invoiceResponse.error);
        } else if (invoiceResponse.data?.skipped) {
          console.log('Lexoffice invoice skipped:', invoiceResponse.data.reason);
        } else {
          console.log('Lexoffice invoice created:', invoiceResponse.data?.invoiceId);
        }
      } catch (invoiceError) {
        console.warn('Lexoffice invoice error:', invoiceError);
      }

      setOrderNumber(newOrderNumber);
      setShowSuccess(true);
      clearCart();
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
  if (items.length === 0 && !showSuccess) {
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
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
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
                  <img src={item.image} alt={name} className="w-10 h-10 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity}× {item.price.toFixed(2).replace('.', ',')} €</p>
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
      {(() => {
        const vatRate = 0.07;
        const netTotal = grandTotal / (1 + vatRate);
        const vatAmount = grandTotal - netTotal;
        
        return (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">{language === 'de' ? 'Zwischensumme' : 'Subtotal'}</span>
              <span>{totalPrice.toFixed(2).replace('.', ',')} €</span>
            </div>
            {minimumOrderSurcharge > 0 && (
              <div className="flex justify-between items-center text-sm text-amber-600 dark:text-amber-400">
                <span className="flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  {language === 'de' ? 'Mindestbest.-Aufschlag' : 'Min. order surcharge'}
                </span>
                <span>+{minimumOrderSurcharge.toFixed(2).replace('.', ',')} €</span>
              </div>
            )}
            {formData.deliveryType === 'delivery' && deliveryCalc && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{language === 'de' ? 'Lieferung' : 'Delivery'}</span>
                <span>
                  {deliveryCalc.isFreeDelivery 
                    ? (language === 'de' ? 'Kostenlos' : 'Free')
                    : `${deliveryCalc.deliveryCost.toFixed(2).replace('.', ',')} €`}
                </span>
              </div>
            )}
            {formData.deliveryType === 'pickup' && (
              <div className="flex justify-between items-center text-sm text-green-600 dark:text-green-400">
                <span>{language === 'de' ? 'Lieferung' : 'Delivery'}</span>
                <span>{language === 'de' ? 'Abholung – 0,00 €' : 'Pickup – €0.00'}</span>
              </div>
            )}
            
            {/* VAT Breakdown */}
            <div className="pt-2 mt-2 border-t border-dashed border-border space-y-1">
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{language === 'de' ? 'Nettobetrag' : 'Net amount'}</span>
                <span>{netTotal.toFixed(2).replace('.', ',')} €</span>
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>{language === 'de' ? '+ 7% MwSt.' : '+ 7% VAT'}</span>
                <span>{vatAmount.toFixed(2).replace('.', ',')} €</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <span className="font-semibold">{language === 'de' ? 'Gesamtbetrag (brutto)' : 'Total (gross)'}</span>
              <span className="text-xl font-bold text-primary">{grandTotal.toFixed(2).replace('.', ',')} €</span>
            </div>
          </div>
        );
      })()}

      {/* CTA Button */}
      <Button 
        type="submit" 
        size="lg" 
        className="w-full text-base py-6 font-semibold shadow-lg hover:shadow-xl transition-all"
        disabled={isSubmitting}
      >
        {isSubmitting 
          ? (language === 'de' ? 'Wird gesendet...' : 'Sending...')
          : (language === 'de' 
              ? `Anfragen · ${grandTotal.toFixed(2).replace('.', ',')} €`
              : `Submit · €${grandTotal.toFixed(2)}`)}
      </Button>

      {/* Trust Elements */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{language === 'de' ? 'Sichere Übertragung' : 'Secure transmission'}</span>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          {language === 'de' 
            ? 'Unverbindliche Anfrage – keine Zahlung jetzt'
            : 'Non-binding request – no payment now'}
        </p>
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
        
        <main className="flex-1 container mx-auto px-4 py-6 md:py-10">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-serif font-medium mb-6 text-center lg:col-span-full">
              {language === 'de' ? 'Bestellung aufgeben' : 'Place Your Order'}
            </h1>

            <form onSubmit={handleSubmit}>
              {/* Two-Column Layout: Form left, Sticky Cart right on desktop */}
              <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">
                
                {/* Left Column: Form Sections */}
                <div className="space-y-6">
                  
                  {/* Mobile Cart Overview (hidden on desktop) */}
                  <section className="lg:hidden bg-card border border-border rounded-xl p-4">
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger className="flex items-center justify-between w-full">
                        <span className="font-serif text-lg">{language === 'de' ? 'Ihre Auswahl' : 'Your Selection'} ({items.length})</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{grandTotal.toFixed(2).replace('.', ',')} €</span>
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
                                  <img src={item.image} alt={name} className="w-10 h-10 rounded object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{name}</p>
                                  <p className="text-xs text-muted-foreground">{item.quantity}× {item.price.toFixed(2).replace('.', ',')} €</p>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">{language === 'de' ? 'Name' : 'Name'} *</Label>
                        <Input
                          id="name"
                          name="name"
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
                          value={formData.email}
                          onChange={handleInputChange}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">{language === 'de' ? 'Telefon' : 'Phone'} *</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
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
                          value={formData.company}
                          onChange={handleInputChange}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Section 2: Delivery/Pickup + Date/Time (Combined) */}
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
                        <div className="mb-4">
                          <Label htmlFor="address" className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {language === 'de' ? 'Lieferadresse' : 'Delivery Address'} *
                          </Label>
                          <Textarea
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleAddressChange}
                            required={formData.deliveryType === 'delivery'}
                            className="mt-1"
                            rows={2}
                            placeholder={language === 'de' ? 'Straße, Hausnummer, PLZ, Stadt' : 'Street, house number, postal code, city'}
                          />
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
                                      {language === 'de' ? 'Entfernung' : 'Distance'}: {deliveryCalc.distanceKm} km
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    {deliveryCalc.isFreeDelivery ? (
                                      <span className="text-lg font-bold text-primary">
                                        {language === 'de' ? 'Kostenlos' : 'Free'}
                                      </span>
                                    ) : (
                                      <span className="text-lg font-bold text-foreground">
                                        {deliveryCalc.deliveryCost.toFixed(2).replace('.', ',')} €
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {minimumOrderSurcharge > 0 && (
                                  <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                                    {language === 'de' 
                                      ? `Aufschlag von ${minimumOrderSurcharge.toFixed(2).replace('.', ',')} € wird hinzugefügt, um Mindestbestellwert von ${deliveryCalc.minimumOrder} € zu erreichen.`
                                      : `A surcharge of €${minimumOrderSurcharge.toFixed(2)} will be added to meet the minimum order of €${deliveryCalc.minimumOrder}.`}
                                  </p>
                                )}
                                
                                <p className="text-xs mt-2 text-muted-foreground">
                                  {language === 'de' ? 'Alle Preise inkl. 7% MwSt.' : 'All prices incl. 7% VAT'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {!deliveryCalc && !isCalculating && formData.address.length < 10 && (
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
                                  <li>• {language === 'de' ? '1-25 km München: 25 € (Mindestbestellwert 150 €)' : '1-25 km Munich: €25 (min. order €150)'}</li>
                                  <li>• {language === 'de' ? 'Außerhalb: 1,28 €/km brutto (Mindestbestellwert 200 €)' : 'Outside: €1.28/km gross (min. order €200)'}</li>
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
                            {language === 'de' ? 'Datum' : 'Date'}
                          </Label>
                          <Input
                            id="date"
                            name="date"
                            type="date"
                            value={formData.date}
                            onChange={handleInputChange}
                            className="mt-1"
                            min={(() => {
                              const tomorrow = new Date();
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              return tomorrow.toISOString().split('T')[0];
                            })()}
                          />
                        </div>
                        <div>
                          <Label htmlFor="time" className="flex items-center gap-1 text-sm">
                            <Clock className="h-3.5 w-3.5" />
                            {language === 'de' ? 'Uhrzeit' : 'Time'}
                          </Label>
                          <Input
                            id="time"
                            name="time"
                            type="time"
                            value={formData.time}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {language === 'de' 
                          ? 'Bitte wählen Sie einen Termin mindestens 24 Stunden im Voraus.'
                          : 'Please select a date at least 24 hours in advance.'}
                      </p>
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

                  {/* Section 4: Notes */}
                  <section className="bg-card border border-border rounded-xl p-4 md:p-6">
                    <h2 className="font-serif text-lg mb-4">
                      {language === 'de' ? 'Anmerkungen (optional)' : 'Notes (optional)'}
                    </h2>
                    <Textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder={language === 'de' 
                        ? 'Besondere Wünsche, Allergien, etc.'
                        : 'Special requests, allergies, etc.'}
                      rows={3}
                    />
                  </section>

                  {/* Mobile Submit (hidden on desktop) */}
                  <div className="lg:hidden space-y-4 pt-2">
                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full text-base py-6 font-semibold shadow-lg"
                      disabled={isSubmitting}
                    >
                      {isSubmitting 
                        ? (language === 'de' ? 'Wird gesendet...' : 'Sending...')
                        : (language === 'de' 
                            ? `Anfragen · ${grandTotal.toFixed(2).replace('.', ',')} €`
                            : `Submit · €${grandTotal.toFixed(2)}`)}
                    </Button>
                    <div className="text-center space-y-1">
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>{language === 'de' ? 'Sichere Übertragung' : 'Secure transmission'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {language === 'de' 
                          ? 'Unverbindliche Anfrage – keine Zahlung jetzt'
                          : 'Non-binding request – no payment now'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: Sticky Cart (Desktop only) */}
                <div className="hidden lg:block lg:sticky lg:top-24">
                  <CartSummary showItems={true} />
                </div>
              </div>
            </form>
          </div>
        </main>
        
        <Footer />
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <DialogTitle className="text-center text-xl">
              {language === 'de' ? 'Anfrage erhalten!' : 'Request Received!'}
            </DialogTitle>
            <DialogDescription className="text-center space-y-2">
              <p>
                {language === 'de' 
                  ? `Vielen Dank für Ihre Anfrage.`
                  : `Thank you for your request.`}
              </p>
              <p className="font-mono text-lg text-foreground">{orderNumber}</p>
              <p>
                {language === 'de'
                  ? 'Wir haben Ihnen eine Bestätigung per E-Mail gesendet und melden uns in Kürze bei Ihnen.'
                  : 'We have sent you a confirmation email and will get back to you shortly.'}
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-4">
            <Button onClick={() => navigate('/')} variant="outline">
              {language === 'de' ? 'Zur Startseite' : 'Back to Home'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Checkout;
