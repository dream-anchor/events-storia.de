import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import storiaLogo from "@/assets/storia-logo.webp";
import { LogOut, ExternalLink } from "lucide-react";
import CateringMenusManager from "@/components/admin/CateringMenusManager";
import CateringOrdersManager from "@/components/admin/CateringOrdersManager";
import EventInquiriesManager from "@/components/admin/EventInquiriesManager";
import { usePendingOrdersCount } from "@/hooks/useCateringOrders";
import { useNewInquiriesCount } from "@/hooks/useEventInquiries";
import { Badge } from "@/components/ui/badge";

const Admin = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading, signOut } = useAdminAuth();
  const { data: pendingOrdersCount } = usePendingOrdersCount();
  const { data: newInquiriesCount } = useNewInquiriesCount();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/admin/login");
    }
  }, [user, isAdmin, loading, navigate]);

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error("Logout error:", error);
        toast.error(`Fehler beim Abmelden: ${error.message}`);
      } else {
        toast.success("Erfolgreich abgemeldet");
        navigate("/admin/login");
      }
    } catch (err) {
      console.error("Unexpected logout error:", err);
      toast.error("Unerwarteter Fehler beim Abmelden");
      navigate("/admin/login");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Mobile optimized */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3">
          {/* Row 1: Logo and Buttons */}
          <div className="flex items-center justify-between">
            <Link to="/">
              <img 
                src={storiaLogo} 
                alt="STORIA" 
                className="h-8 md:h-10 hover:opacity-80 transition-opacity cursor-pointer" 
              />
            </Link>
            <div className="flex items-center gap-2">
              {/* Desktop: Full buttons */}
              <Button variant="outline" size="sm" asChild className="hidden sm:flex">
                <Link to="/">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Zur Webseite
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden sm:flex">
                <LogOut className="h-4 w-4 mr-2" />
                Abmelden
              </Button>
              {/* Mobile: Icon-only buttons */}
              <Button variant="outline" size="icon" asChild className="sm:hidden h-10 w-10">
                <Link to="/">
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="icon" onClick={handleSignOut} className="sm:hidden h-10 w-10">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Row 2: Title and Email */}
          <div className="mt-2">
            <h1 className="font-serif font-semibold text-lg md:text-xl">Admin-Dashboard</h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        {/* Catering Orders Section */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl md:text-2xl font-serif font-semibold">Catering-Bestellungen</h2>
            {pendingOrdersCount && pendingOrdersCount > 0 && (
              <Badge className="bg-amber-500 text-white">{pendingOrdersCount} neu</Badge>
            )}
          </div>
          <p className="text-sm md:text-base text-muted-foreground mb-6">
            Verwalten Sie eingehende Catering-Anfragen und ändern Sie den Status.
          </p>
          <CateringOrdersManager />
        </div>

        {/* Event Inquiries Section */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-xl md:text-2xl font-serif font-semibold">Event-Anfragen</h2>
            {newInquiriesCount && newInquiriesCount > 0 && (
              <Badge className="bg-amber-500 text-white">{newInquiriesCount} neu</Badge>
            )}
          </div>
          <p className="text-sm md:text-base text-muted-foreground mb-6">
            Verwalten Sie Event-Anfragen für Firmenfeiern, Hochzeiten und mehr.
          </p>
          <EventInquiriesManager />
        </div>

        {/* Catering Menüs Section */}
        <div className="mb-8 md:mb-12">
          <h2 className="text-xl md:text-2xl font-serif font-semibold mb-2">Catering-Menüs</h2>
          <p className="text-sm md:text-base text-muted-foreground mb-6">
            Verwalten Sie die Catering-Angebote für Ihre Kunden.
          </p>
          <CateringMenusManager />
        </div>
      </main>
    </div>
  );
};

export default Admin;
