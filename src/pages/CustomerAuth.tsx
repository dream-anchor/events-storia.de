import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, User, ArrowLeft } from 'lucide-react';

const CustomerAuth = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, signup, loading: authLoading } = useCustomerAuth();
  
  // Get redirect path from state if passed (e.g., from checkout)
  const redirectPath = (location.state as { redirect?: string })?.redirect || '/konto';
  
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState('');

  // Password reset
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate(redirectPath);
    }
  }, [user, authLoading, navigate, redirectPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error(language === 'de' ? 'Bitte alle Felder ausfüllen' : 'Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    const { error } = await login(loginEmail, loginPassword);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast.error(language === 'de' ? 'E-Mail oder Passwort falsch' : 'Invalid email or password');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(language === 'de' ? 'Erfolgreich eingeloggt!' : 'Successfully logged in!');
      navigate(redirectPath);
    }
    setIsSubmitting(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registerEmail || !registerPassword || !registerPasswordConfirm) {
      toast.error(language === 'de' ? 'Bitte alle Pflichtfelder ausfüllen' : 'Please fill in all required fields');
      return;
    }

    if (registerPassword.length < 6) {
      toast.error(language === 'de' ? 'Passwort muss mindestens 6 Zeichen haben' : 'Password must be at least 6 characters');
      return;
    }

    if (registerPassword !== registerPasswordConfirm) {
      toast.error(language === 'de' ? 'Passwörter stimmen nicht überein' : 'Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    const { error } = await signup(registerEmail, registerPassword, registerName);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error(language === 'de' ? 'Diese E-Mail ist bereits registriert' : 'This email is already registered');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success(
        language === 'de' 
          ? 'Konto erstellt! Sie können sich jetzt einloggen.' 
          : 'Account created! You can now log in.'
      );
      setActiveTab('login');
      setLoginEmail(registerEmail);
    }
    setIsSubmitting(false);
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast.error(language === 'de' ? 'Bitte E-Mail eingeben' : 'Please enter email');
      return;
    }

    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/konto/passwort-reset`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        language === 'de' 
          ? 'Falls ein Konto existiert, wurde ein Link gesendet.' 
          : 'If an account exists, a reset link has been sent.'
      );
      setShowResetDialog(false);
      setResetEmail('');
    }
    setIsResetting(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title={language === 'de' ? 'Kundenkonto | STORIA Catering' : 'Customer Account | STORIA Catering'}
        description={language === 'de' ? 'Anmelden oder registrieren für Ihr STORIA Catering Kundenkonto.' : 'Login or register for your STORIA Catering customer account.'}
      />
      <Header />
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            {language === 'de' ? 'Zurück zur Startseite' : 'Back to home'}
          </Link>

          <Card className="border-border/50">
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-serif text-2xl">
                {language === 'de' ? 'Kundenkonto' : 'Customer Account'}
              </CardTitle>
              <CardDescription>
                {language === 'de' 
                  ? 'Anmelden oder neues Konto erstellen' 
                  : 'Sign in or create a new account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">
                    {language === 'de' ? 'Anmelden' : 'Login'}
                  </TabsTrigger>
                  <TabsTrigger value="register">
                    {language === 'de' ? 'Registrieren' : 'Register'}
                  </TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        E-Mail
                      </Label>
                      <Input
                        id="login-email"
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="ihre@email.de"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        {language === 'de' ? 'Passwort' : 'Password'}
                      </Label>
                      <Input
                        id="login-password"
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {language === 'de' ? 'Anmelden' : 'Login'}
                    </Button>
                    
                    {/* Password Reset Link */}
                    <div className="text-center pt-2">
                      <button 
                        type="button"
                        onClick={() => {
                          setResetEmail(loginEmail);
                          setShowResetDialog(true);
                        }}
                        className="text-sm text-muted-foreground hover:text-primary underline transition-colors"
                      >
                        {language === 'de' ? 'Passwort vergessen?' : 'Forgot password?'}
                      </button>
                    </div>
                  </form>
                </TabsContent>

                {/* Register Tab */}
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {language === 'de' ? 'Name (optional)' : 'Name (optional)'}
                      </Label>
                      <Input
                        id="register-name"
                        type="text"
                        value={registerName}
                        onChange={(e) => setRegisterName(e.target.value)}
                        placeholder="Max Mustermann"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        E-Mail *
                      </Label>
                      <Input
                        id="register-email"
                        type="email"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        placeholder="ihre@email.de"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        {language === 'de' ? 'Passwort *' : 'Password *'}
                      </Label>
                      <Input
                        id="register-password"
                        type="password"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        {language === 'de' ? 'Mindestens 6 Zeichen' : 'At least 6 characters'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password-confirm" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        {language === 'de' ? 'Passwort bestätigen *' : 'Confirm password *'}
                      </Label>
                      <Input
                        id="register-password-confirm"
                        type="password"
                        value={registerPasswordConfirm}
                        onChange={(e) => setRegisterPasswordConfirm(e.target.value)}
                        placeholder="••••••••"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {language === 'de' ? 'Konto erstellen' : 'Create account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Password Reset Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === 'de' ? 'Passwort zurücksetzen' : 'Reset Password'}
            </DialogTitle>
            <DialogDescription>
              {language === 'de' 
                ? 'Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen.' 
                : 'Enter your email address and we will send you a reset link.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-Mail</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="ihre@email.de"
              />
            </div>
            <Button 
              onClick={handlePasswordReset} 
              className="w-full" 
              disabled={isResetting}
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {language === 'de' ? 'Link senden' : 'Send Link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default CustomerAuth;