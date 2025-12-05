import { useState } from 'react';
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
import { Minus, Plus, Trash2, CheckCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

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

    try {
      const { error } = await supabase
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
          notes: formData.notes || null,
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            name_en: item.name_en,
            quantity: item.quantity,
            price: item.price
          })),
          total_amount: totalPrice
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
            deliveryAddress: formData.deliveryType === 'delivery' ? formData.address : undefined,
            isPickup: formData.deliveryType === 'pickup',
            desiredDate: formData.date || undefined,
            desiredTime: formData.time || undefined,
            notes: formData.notes || undefined,
            items: items.map(item => ({
              id: item.id,
              name: item.name,
              name_en: item.name_en,
              quantity: item.quantity,
              price: item.price
            })),
            totalAmount: totalPrice
          }
        });
        
        if (emailResponse.error) {
          console.error('Email notification error:', emailResponse.error);
          // Don't fail the order if email fails
        } else {
          console.log('Email notifications sent successfully');
        }
      } catch (emailError) {
        console.error('Email notification error:', emailError);
        // Don't fail the order if email fails
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

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Bestellung aufgeben | STORIA' : 'Place Order | STORIA'}
        description=""
      />
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <Navigation />
        
        <main className="flex-1 container mx-auto px-4 py-8 md:py-16">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl md:text-3xl font-serif font-medium mb-8 text-center">
              {language === 'de' ? 'Bestellung aufgeben' : 'Place Your Order'}
            </h1>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Cart Overview */}
              <section className="bg-card border border-border rounded-lg p-4 md:p-6">
                <h2 className="font-serif text-lg mb-4">
                  {language === 'de' ? 'Ihre Auswahl' : 'Your Selection'}
                </h2>
                <div className="space-y-3">
                  {items.map((item) => {
                    const name = language === 'en' && item.name_en ? item.name_en : item.name;
                    return (
                      <div key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        {item.image && (
                          <img src={item.image} alt={name} className="w-12 h-12 rounded object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{name}</p>
                          <p className="text-sm text-primary">{item.price.toFixed(2).replace('.', ',')} €</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                  <span className="font-medium">{language === 'de' ? 'Gesamt' : 'Total'}</span>
                  <span className="text-xl font-bold text-primary">{totalPrice.toFixed(2).replace('.', ',')} €</span>
                </div>
              </section>

              {/* Contact Details */}
              <section className="bg-card border border-border rounded-lg p-4 md:p-6">
                <h2 className="font-serif text-lg mb-4">
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

                <div className="mt-6">
                  <Label>{language === 'de' ? 'Lieferung / Abholung' : 'Delivery / Pickup'}</Label>
                  <RadioGroup
                    value={formData.deliveryType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, deliveryType: value }))}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="delivery" id="delivery" />
                      <Label htmlFor="delivery" className="font-normal cursor-pointer">
                        {language === 'de' ? 'Lieferung' : 'Delivery'}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pickup" id="pickup" />
                      <Label htmlFor="pickup" className="font-normal cursor-pointer">
                        {language === 'de' ? 'Selbstabholung' : 'Pickup'}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {formData.deliveryType === 'delivery' && (
                  <div className="mt-4">
                    <Label htmlFor="address">{language === 'de' ? 'Lieferadresse' : 'Delivery Address'} *</Label>
                    <Textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required={formData.deliveryType === 'delivery'}
                      className="mt-1"
                      rows={2}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="date">{language === 'de' ? 'Wunschdatum' : 'Preferred Date'}</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="mt-1"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">{language === 'de' ? 'Wunschzeit' : 'Preferred Time'}</Label>
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
              </section>

              {/* Notes */}
              <section className="bg-card border border-border rounded-lg p-4 md:p-6">
                <h2 className="font-serif text-lg mb-4">
                  {language === 'de' ? 'Anmerkungen' : 'Notes'}
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

              {/* Submit */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {language === 'de' 
                    ? 'Diese Anfrage ist unverbindlich. Wir kontaktieren Sie zur Bestätigung.'
                    : 'This request is non-binding. We will contact you to confirm.'}
                </p>
                <Button type="submit" size="lg" className="px-12" disabled={isSubmitting}>
                  {isSubmitting 
                    ? (language === 'de' ? 'Wird gesendet...' : 'Sending...')
                    : (language === 'de' ? 'Unverbindlich anfragen' : 'Submit Request')}
                </Button>
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
                  ? 'Vielen Dank für Ihre Anfrage. Wir melden uns innerhalb von 24 Stunden bei Ihnen.'
                  : 'Thank you for your request. We will contact you within 24 hours.'}
              </p>
              <p className="font-mono font-medium text-foreground">
                {language === 'de' ? 'Bestellnummer' : 'Order Number'}: {orderNumber}
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
