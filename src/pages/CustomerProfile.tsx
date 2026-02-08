import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocalizedLink } from '@/components/LocalizedLink';
import { useLocalizedPath } from '@/hooks/useLocalizedPath';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCustomerAuth, CustomerProfile as CustomerProfileType } from '@/contexts/CustomerAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, User, MapPin, FileText, LogOut, ArrowLeft, Package, Calendar, Check, Clock, Download } from 'lucide-react';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  status: string | null;
  total_amount: number | null;
  desired_date: string | null;
  desired_time: string | null;
  items: unknown;
  lexoffice_invoice_id: string | null;
  lexoffice_document_type: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  payment_method: string | null;
  payment_status: string | null;
}

const CustomerProfile = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { getPath } = useLocalizedPath();
  const { user, profile, loading: authLoading, logout, updateProfile, refreshProfile } = useCustomerAuth();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    company: '',
    delivery_street: '',
    delivery_city: '',
    delivery_zip: '',
    billing_name: '',
    billing_street: '',
    billing_city: '',
    billing_zip: '',
  });

  // Redirect if not logged in
  useEffect(() => {
    if (!user && !authLoading) {
      navigate(getPath('login'));
    }
  }, [user, authLoading, navigate]);

  // Load profile data into form
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        company: profile.company || '',
        delivery_street: profile.delivery_street || '',
        delivery_city: profile.delivery_city || '',
        delivery_zip: profile.delivery_zip || '',
        billing_name: profile.billing_name || '',
        billing_street: profile.billing_street || '',
        billing_city: profile.billing_city || '',
        billing_zip: profile.billing_zip || '',
      });
    }
  }, [profile]);

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('catering_orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching orders:', error);
        } else {
          // Filter out orders without created_at for type safety
          setOrders((data || []).filter((o): o is typeof o & { created_at: string } => o.created_at !== null));
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setOrdersLoading(false);
      }
    };

    if (user) {
      fetchOrders();
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveProfile = async () => {
    setIsUpdating(true);
    
    const { error } = await updateProfile({
      name: formData.name || null,
      phone: formData.phone || null,
      company: formData.company || null,
      delivery_street: formData.delivery_street || null,
      delivery_city: formData.delivery_city || null,
      delivery_zip: formData.delivery_zip || null,
      billing_name: formData.billing_name || null,
      billing_street: formData.billing_street || null,
      billing_city: formData.billing_city || null,
      billing_zip: formData.billing_zip || null,
    } as Partial<CustomerProfileType>);

    if (error) {
      toast.error(language === 'de' ? 'Fehler beim Speichern' : 'Error saving');
    } else {
      toast.success(language === 'de' ? 'Profil gespeichert' : 'Profile saved');
    }
    setIsUpdating(false);
  };

  const handleLogout = async () => {
    await logout();
    toast.success(language === 'de' ? 'Erfolgreich abgemeldet' : 'Successfully logged out');
    navigate('/');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { 
        label: language === 'de' ? 'Ausstehend' : 'Pending', 
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' 
      },
      confirmed: { 
        label: language === 'de' ? 'Bestätigt' : 'Confirmed', 
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' 
      },
      completed: { 
        label: language === 'de' ? 'Abgeschlossen' : 'Completed', 
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' 
      },
      cancelled: { 
        label: language === 'de' ? 'Storniert' : 'Cancelled', 
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' 
      },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  // Download LexOffice document
  const downloadDocument = async (orderId: string) => {
    setDownloadingDoc(orderId);
    try {
      const { data, error } = await supabase.functions.invoke('get-lexoffice-document', {
        body: { orderId }
      });
      
      if (error || data?.error) {
        console.error('Document download error:', error || data?.error);
        toast.error(language === 'de' ? 'Dokument nicht verfügbar' : 'Document not available');
        return;
      }
      
      // Create download link from base64
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(language === 'de' ? 'Dokument heruntergeladen' : 'Document downloaded');
    } catch (err) {
      console.error('Download error:', err);
      toast.error(language === 'de' ? 'Fehler beim Herunterladen' : 'Error downloading');
    } finally {
      setDownloadingDoc(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title={language === 'de' ? 'Mein Konto | STORIA Catering' : 'My Account | STORIA Catering'}
        description={language === 'de' ? 'Verwalten Sie Ihr STORIA Catering Kundenkonto.' : 'Manage your STORIA Catering customer account.'}
      />
      <Header />
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === 'de' ? 'Zurück' : 'Back'}
            </Link>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              {language === 'de' ? 'Abmelden' : 'Logout'}
            </Button>
          </div>

          <h1 className="font-serif text-3xl mb-2">
            {language === 'de' ? 'Mein Konto' : 'My Account'}
          </h1>
          <p className="text-muted-foreground mb-8">{profile?.email}</p>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList>
              <TabsTrigger value="profile" className="gap-2">
                <User className="h-4 w-4" />
                {language === 'de' ? 'Profil' : 'Profile'}
              </TabsTrigger>
              <TabsTrigger value="orders" className="gap-2">
                <Package className="h-4 w-4" />
                {language === 'de' ? 'Bestellungen' : 'Orders'}
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {language === 'de' ? 'Kontaktdaten' : 'Contact Details'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">{language === 'de' ? 'Name' : 'Name'}</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Max Mustermann"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{language === 'de' ? 'Telefon' : 'Phone'}</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+49 ..."
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="company">{language === 'de' ? 'Firma (optional)' : 'Company (optional)'}</Label>
                    <Input
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      placeholder="Firmenname"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    {language === 'de' ? 'Lieferadresse' : 'Delivery Address'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'de' ? 'Wird im Checkout vorausgefüllt' : 'Pre-filled in checkout'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="delivery_street">{language === 'de' ? 'Straße & Hausnummer' : 'Street & Number'}</Label>
                    <Input
                      id="delivery_street"
                      name="delivery_street"
                      value={formData.delivery_street}
                      onChange={handleInputChange}
                      placeholder="Musterstraße 123"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_zip">{language === 'de' ? 'PLZ' : 'ZIP'}</Label>
                    <Input
                      id="delivery_zip"
                      name="delivery_zip"
                      value={formData.delivery_zip}
                      onChange={handleInputChange}
                      placeholder="80333"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_city">{language === 'de' ? 'Stadt' : 'City'}</Label>
                    <Input
                      id="delivery_city"
                      name="delivery_city"
                      value={formData.delivery_city}
                      onChange={handleInputChange}
                      placeholder="München"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {language === 'de' ? 'Rechnungsadresse' : 'Billing Address'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="billing_name">{language === 'de' ? 'Name / Firma' : 'Name / Company'}</Label>
                    <Input
                      id="billing_name"
                      name="billing_name"
                      value={formData.billing_name}
                      onChange={handleInputChange}
                      placeholder="Max Mustermann / Firma GmbH"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="billing_street">{language === 'de' ? 'Straße & Hausnummer' : 'Street & Number'}</Label>
                    <Input
                      id="billing_street"
                      name="billing_street"
                      value={formData.billing_street}
                      onChange={handleInputChange}
                      placeholder="Musterstraße 123"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_zip">{language === 'de' ? 'PLZ' : 'ZIP'}</Label>
                    <Input
                      id="billing_zip"
                      name="billing_zip"
                      value={formData.billing_zip}
                      onChange={handleInputChange}
                      placeholder="80333"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="billing_city">{language === 'de' ? 'Stadt' : 'City'}</Label>
                    <Input
                      id="billing_city"
                      name="billing_city"
                      value={formData.billing_city}
                      onChange={handleInputChange}
                      placeholder="München"
                    />
                  </div>
                </CardContent>
              </Card>

              <Button onClick={handleSaveProfile} disabled={isUpdating} className="w-full sm:w-auto">
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {language === 'de' ? 'Änderungen speichern' : 'Save changes'}
              </Button>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {language === 'de' ? 'Bestellverlauf' : 'Order History'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{language === 'de' ? 'Noch keine Bestellungen' : 'No orders yet'}</p>
                      <Button asChild variant="outline" className="mt-4">
                        <Link to="/catering">
                          {language === 'de' ? 'Jetzt bestellen' : 'Order now'}
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => {
                        const isPaid = order.payment_method === 'stripe' && order.payment_status === 'paid';
                        
                        return (
                        <div 
                          key={order.id} 
                          className={`border rounded-lg p-4 ${
                            order.status === 'cancelled' 
                              ? 'border-destructive/30 bg-destructive/5' 
                              : 'border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium">#{order.order_number}</p>
                              {/* Document type and order date */}
                              <div className="flex items-center gap-2 mt-1">
                                {isPaid ? (
                                  <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                    {language === 'de' ? 'Bezahlt' : 'Paid'}
                                  </span>
                                ) : (
                                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                    {language === 'de' ? 'Angebot' : 'Quote'}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {language === 'de' ? 'vom' : 'from'} {order.created_at && new Date(order.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                            {getStatusBadge(order.status || 'pending')}
                          </div>

                          {/* Cancellation info */}
                          {order.status === 'cancelled' && order.cancelled_at && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-3">
                              <p className="text-destructive font-medium text-sm">
                                {language === 'de' ? 'Diese Bestellung wurde storniert' : 'This order was cancelled'}
                              </p>
                              <p className="text-destructive/80 text-sm">
                                {language === 'de' ? 'Storniert am' : 'Cancelled on'}: {new Date(order.cancelled_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                {' '}{new Date(order.cancelled_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {order.cancellation_reason && (
                                <p className="text-destructive/80 text-sm mt-1">
                                  {language === 'de' ? 'Grund' : 'Reason'}: {order.cancellation_reason}
                                </p>
                              )}
                            </div>
                          )}
                          
                          {/* Delivery date */}
                          {order.desired_date && (
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {language === 'de' ? 'Lieferung' : 'Delivery'}: {new Date(order.desired_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </span>
                              {order.desired_time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {order.desired_time}
                                </span>
                              )}
                            </div>
                          )}

                          <Separator className="my-3" />

                          <div className="space-y-1 text-sm">
                            {(Array.isArray(order.items) ? order.items : []).map((item: OrderItem, idx: number) => (
                              <div key={idx} className="flex justify-between">
                                <span>{item.quantity}x {item.name}</span>
                                <span className="text-muted-foreground">
                                  {(item.price * item.quantity).toFixed(2)} €
                                </span>
                              </div>
                            ))}
                          </div>

                          <Separator className="my-3" />

                          <div className="flex justify-between items-center font-medium">
                            <span>{language === 'de' ? 'Gesamt' : 'Total'}</span>
                            <span>{order.total_amount?.toFixed(2)} €</span>
                          </div>
                          
                          {/* Document Download */}
                          {order.lexoffice_invoice_id && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadDocument(order.id)}
                                disabled={downloadingDoc === order.id}
                                className="gap-2 w-full sm:w-auto"
                              >
                                {downloadingDoc === order.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                                {(() => {
                                  const isEventBooking = order.order_number.startsWith('EVT-BUCHUNG');
                                  // Shop orders are always paid via Stripe, so they are always invoices/confirmations
                                  const isInvoice = order.lexoffice_document_type === 'invoice' || 
                                                    order.order_number.includes('-BESTELLUNG') ||
                                                    order.order_number.includes('-RECHNUNG');
                                  
                                  if (isEventBooking) {
                                    return language === 'de' ? 'Bestellbestätigung herunterladen' : 'Download Confirmation';
                                  } else if (isInvoice) {
                                    return language === 'de' ? 'Rechnung herunterladen' : 'Download Invoice';
                                  } else {
                                    // Fallback for legacy orders
                                    return language === 'de' ? 'Dokument herunterladen' : 'Download Document';
                                  }
                                })()}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CustomerProfile;
