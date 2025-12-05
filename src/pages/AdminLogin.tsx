import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";
import storiaLogo from "@/assets/storia-logo.webp";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben"),
});

const AdminLogin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading, signIn } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/admin");
    }
  }, [user, isAdmin, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setIsLoading(false);
        return;
      }

      const { error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Ungültige Anmeldedaten");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Erfolgreich angemeldet");
      }
    } catch (err) {
      toast.error("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={storiaLogo} alt="STORIA" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-serif font-semibold">Admin-Bereich</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-6 bg-card p-8 rounded-lg border border-border">
          <div className="space-y-2">
            <Label htmlFor="login-email">E-Mail</Label>
            <Input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ristorantestoria.de"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">Passwort</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Anmelden..." : "Anmelden"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <a href="/" className="hover:underline">
            ← Zurück zur Website
          </a>
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
