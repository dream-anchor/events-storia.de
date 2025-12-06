import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePriceDisplay } from '@/contexts/PriceDisplayContext';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Lock, ArrowRight, Home, ShoppingBag, Truck, MapPin, CalendarDays, CreditCard, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  name: string;
  name_en: string | null;
  quantity: number;
  price: number;
  total: number;
}

interface OrderDetails {
  items: OrderItem[];
  deliveryType: 'pickup' | 'delivery';
  deliveryAddress?: string | null;
  date?: string;
  time?: string;
  subtotal: number;
  deliveryCost: number;
  grandTotal: number;
  paymentMethod: 'invoice' | 'stripe';
  company?: string;
}

interface LocationState {
  email?: string;
  name?: string;
  orderNumber?: string;
  orderDetails?: OrderDetails;
}

const CustomerRegister = () => {
  const { language } = useLanguage();
  const { formatPrice } = usePriceDisplay();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signup, loading } = useCustomerAuth();
  
  const state = location.state as LocationState | null;
  const email = state?.email || '';
  const name = state?.name || '';
  const orderNumber = state?.orderNumber || '';
  const orderDetails = state?.orderDetails;
  
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/konto');
    }
  }, [user, loading, navigate]);

  // Redirect only if accessed directly without order data
  useEffect(() => {
    if (!state?.email && !state?.orderNumber) {
      navigate('/');
    }
  }, [state, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || password.length < 6) {
      toast.error(language === 'de' ? 'Passwort muss mindestens 6 Zeichen haben' : 'Password must be at least 6 characters');
      return;
    }
    
    if (password !== passwordConfirm) {
      toast.error(language === 'de' ? 'Passwörter stimmen nicht überein' : 'Passwords do not match');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await signup(email, password, name);
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error(language === 'de' ? 'Diese E-Mail ist bereits registriert' : 'This email is already registered');
        } else {
          toast.error(language === 'de' ? 'Fehler bei der Kontoerstellung' : 'Account creation failed');
        }
        return;
      }
      toast.success(language === 'de' ? 'Konto erstellt! Bitte bestätigen Sie Ihre E-Mail.' : 'Account created! Please confirm your email.');
      navigate('/konto');
    } catch (err) {
      toast.error(language === 'de' ? 'Ein Fehler ist aufgetreten' : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <SEO 
        title={language === 'de' ? 'Bestellung erfolgreich | STORIA' : 'Order Successful | STORIA'}
        description={language === 'de' ? 'Ihre Bestellung war erfolgreich' : 'Your order was successful'}
      />
      
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <Navigation />
        
        <main className="flex-1 py-12">
          <div className="container max-w-lg mx-auto px-4">
            
            {/* Success Message */}
            <div className="mb-6 p-6 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="font-serif text-xl mb-2">
                {language === 'de' ? 'Bestellung erfolgreich!' : 'Order Successful!'}
              </h2>
              <p className="text-muted-foreground">
                {language === 'de' 
                  ? 'Vielen Dank für Ihre Bestellung. Wir haben Ihnen eine Bestätigung per E-Mail gesendet.'
                  : 'Thank you for your order. We have sent you a confirmation email.'}
              </p>
              {orderNumber && (
                <p className="font-mono text-lg mt-2 text-foreground">{orderNumber}</p>
              )}
            </div>
            
            {/* Order Details */}
            {orderDetails && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    {language === 'de' ? 'Ihre Bestellung' : 'Your Order'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Items List */}
                  <div className="divide-y divide-border">
                    {orderDetails.items.map((item, index) => (
                      <div key={index} className="py-2 flex justify-between text-sm">
                        <div>
                          <span className="font-medium">{item.quantity}×</span>{' '}
                          {language === 'en' && item.name_en ? item.name_en : item.name}
                        </div>
                        <span>{formatPrice(item.total)}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Price Summary */}
                  <div className="pt-3 border-t border-border space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{language === 'de' ? 'Zwischensumme' : 'Subtotal'}</span>
                      <span>{formatPrice(orderDetails.subtotal)}</span>
                    </div>
                    {orderDetails.deliveryCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{language === 'de' ? 'Lieferung' : 'Delivery'}</span>
                        <span>{formatPrice(orderDetails.deliveryCost)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-base pt-2 border-t border-border">
                      <span>{language === 'de' ? 'Gesamt' : 'Total'}</span>
                      <span>{formatPrice(orderDetails.grandTotal)}</span>
                    </div>
                  </div>
                  
                  {/* Delivery/Pickup Info */}
                  <div className="pt-3 border-t border-border">
                    <div className="flex items-start gap-2">
                      {orderDetails.deliveryType === 'delivery' ? (
                        <>
                          <Truck className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">
                              {language === 'de' ? 'Lieferung an:' : 'Delivery to:'}
                            </p>
                            <p className="text-sm text-muted-foreground whitespace-pre-line">
                              {orderDetails.deliveryAddress}
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">
                              {language === 'de' ? 'Abholung im Restaurant' : 'Pickup at Restaurant'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Karlstraße 47a, 80333 München
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Date & Time */}
                    {(orderDetails.date || orderDetails.time) && (
                      <div className="flex items-center gap-2 mt-3">
                        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">
                          {orderDetails.date && new Date(orderDetails.date).toLocaleDateString(language === 'de' ? 'de-DE' : 'en-US', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long' 
                          })}
                          {orderDetails.time && ` ${language === 'de' ? 'um' : 'at'} ${orderDetails.time} ${language === 'de' ? 'Uhr' : ''}`}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Payment Method */}
                  <div className="pt-3 border-t border-border flex items-center gap-2">
                    {orderDetails.paymentMethod === 'stripe' ? (
                      <>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{language === 'de' ? 'Bezahlt per Kreditkarte' : 'Paid by credit card'}</span>
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{language === 'de' ? 'Zahlung per Rechnung' : 'Payment by invoice'}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Registration Card */}
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="font-serif text-2xl">
                  {language === 'de' ? 'Konto erstellen?' : 'Create an Account?'}
                </CardTitle>
                <CardDescription>
                  {language === 'de' 
                    ? 'Verwalten Sie Ihre Bestellungen und bestellen Sie schneller.' 
                    : 'Manage your orders and checkout faster.'}
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      {language === 'de' ? 'E-Mail:' : 'Email:'}{' '}
                      <span className="font-medium text-foreground">{email}</span>
                    </p>
                    {name && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {language === 'de' ? 'Name:' : 'Name:'}{' '}
                        <span className="font-medium text-foreground">{name}</span>
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="password" className="text-sm flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" />
                        {language === 'de' ? 'Passwort wählen' : 'Choose Password'}
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={language === 'de' ? 'Mind. 6 Zeichen' : 'Min. 6 characters'}
                        className="mt-1"
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="password-confirm" className="text-sm flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" />
                        {language === 'de' ? 'Passwort bestätigen' : 'Confirm Password'}
                      </Label>
                      <Input
                        id="password-confirm"
                        type="password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder={language === 'de' ? 'Passwort wiederholen' : 'Repeat password'}
                        className="mt-1"
                        required
                      />
                    </div>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting 
                      ? (language === 'de' ? 'Wird erstellt...' : 'Creating...') 
                      : (language === 'de' ? 'Konto erstellen' : 'Create Account')}
                    {!isSubmitting && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </form>
                
                <div className="mt-6 pt-4 border-t border-border">
                  <Button 
                    variant="ghost" 
                    className="w-full text-muted-foreground"
                    onClick={() => navigate('/')}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    {language === 'de' ? 'Nein danke, zur Startseite' : 'No thanks, go to homepage'}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default CustomerRegister;