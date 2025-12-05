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
import { Loader2, Lock, CheckCircle } from 'lucide-react';

const PasswordReset = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Check if we have a valid session from the reset link
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User has clicked the reset link and is now in recovery mode
        console.log('Password recovery mode active');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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