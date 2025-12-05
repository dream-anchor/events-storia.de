import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Lock, CheckCircle, AlertCircle } from 'lucide-react';

const PasswordReset = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Parse URL hash and set up recovery session
  useEffect(() => {
    const handleRecovery = async () => {
      // Parse hash params from Supabase magic link
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      // Also check query params (some email clients may convert)
      const queryParams = new URLSearchParams(window.location.search);
      const queryAccessToken = queryParams.get('access_token');
      const queryRefreshToken = queryParams.get('refresh_token');
      const queryType = queryParams.get('type');
      
      const finalAccessToken = accessToken || queryAccessToken;
      const finalRefreshToken = refreshToken || queryRefreshToken;
      const finalType = type || queryType;

      if (finalAccessToken && finalType === 'recovery') {
        try {
          // Set session with the recovery token
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: finalAccessToken,
            refresh_token: finalRefreshToken || '',
          });
          
          if (sessionError) {
            console.error('Session error:', sessionError);
            setError(language === 'de' 
              ? 'Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen Link an.' 
              : 'The link is invalid or expired. Please request a new link.');
          } else {
            setIsRecoveryMode(true);
            // Clean URL
            window.history.replaceState({}, '', '/konto/passwort-reset');
          }
        } catch (err) {
          console.error('Recovery error:', err);
          setError(language === 'de' 
            ? 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.' 
            : 'An error occurred. Please try again.');
        }
      } else {
        // No token in URL, check if user came from auth state change
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsRecoveryMode(true);
        } else {
          setError(language === 'de' 
            ? 'Kein gültiger Reset-Link gefunden. Bitte fordern Sie einen neuen Link an.' 
            : 'No valid reset link found. Please request a new link.');
        }
      }
      
      setIsLoading(false);
    };

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true);
        setIsLoading(false);
      }
    });

    handleRecovery();

    return () => subscription.unsubscribe();
  }, [language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error(language === 'de' ? 'Passwort muss mindestens 6 Zeichen haben' : 'Password must be at least 6 characters');
      return;
    }

    if (password !== passwordConfirm) {
      toast.error(language === 'de' ? 'Passwörter stimmen nicht überein' : 'Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
    } else {
      setIsSuccess(true);
      toast.success(language === 'de' ? 'Passwort erfolgreich geändert!' : 'Password changed successfully!');
      setTimeout(() => navigate('/konto'), 2000);
    }

    setIsSubmitting(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SEO 
          title={language === 'de' ? 'Passwort zurücksetzen | STORIA' : 'Reset Password | STORIA'}
          description=""
        />
        <Header />
        <Navigation />
        
        <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">
              {language === 'de' ? 'Wird geladen...' : 'Loading...'}
            </p>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Error state (invalid/expired link)
  if (error && !isRecoveryMode) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SEO 
          title={language === 'de' ? 'Link ungültig | STORIA' : 'Invalid Link | STORIA'}
          description=""
        />
        <Header />
        <Navigation />
        
        <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h2 className="font-serif text-xl mb-2">
                {language === 'de' ? 'Link ungültig' : 'Invalid Link'}
              </h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => navigate('/login')} variant="outline">
                {language === 'de' ? 'Zurück zum Login' : 'Back to Login'}
              </Button>
            </CardContent>
          </Card>
        </main>

        <Footer />
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SEO 
          title={language === 'de' ? 'Passwort geändert | STORIA' : 'Password Changed | STORIA'}
          description=""
        />
        <Header />
        <Navigation />
        
        <main className="flex-1 container mx-auto px-4 py-12 flex items-center justify-center">
          <Card className="max-w-md w-full text-center">
            <CardContent className="pt-8 pb-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="font-serif text-xl mb-2">
                {language === 'de' ? 'Passwort geändert!' : 'Password Changed!'}
              </h2>
              <p className="text-muted-foreground">
                {language === 'de' 
                  ? 'Sie werden zum Kundenkonto weitergeleitet...' 
                  : 'Redirecting to your account...'}
              </p>
            </CardContent>
          </Card>
        </main>

        <Footer />
      </div>
    );
  }

  // Password reset form
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO 
        title={language === 'de' ? 'Neues Passwort festlegen | STORIA' : 'Set New Password | STORIA'}
        description=""
      />
      <Header />
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto">
          <Card className="border-border/50">
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-serif text-2xl">
                {language === 'de' ? 'Neues Passwort festlegen' : 'Set New Password'}
              </CardTitle>
              <CardDescription>
                {language === 'de' 
                  ? 'Geben Sie Ihr neues Passwort ein' 
                  : 'Enter your new password'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {language === 'de' ? 'Neues Passwort' : 'New Password'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === 'de' ? 'Mindestens 6 Zeichen' : 'At least 6 characters'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-confirm" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {language === 'de' ? 'Passwort bestätigen' : 'Confirm Password'}
                  </Label>
                  <Input
                    id="password-confirm"
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {language === 'de' ? 'Passwort speichern' : 'Save Password'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PasswordReset;
