import { useState } from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  customerEmail: string;
  customerName?: string;
  customerId?: string;
}

/**
 * Kompakter Icon-Button für Listen/Tabellen — lädt den Kunden per Mausklick
 * zum eigenen Konto ein. Idempotent: bestehende Konten werden serverseitig erkannt.
 */
export function InviteCustomerIconButton({ customerEmail, customerName, customerId }: Props) {
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!customerEmail) {
      toast.error("Keine E-Mail-Adresse hinterlegt");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-customer-account", {
        body: { customerEmail, customerName, customerId },
      });
      if (error) throw error;
      const res = data as { success: boolean; alreadyExists?: boolean; error?: string };
      if (res.alreadyExists) {
        toast.info("Kunde hat bereits ein Konto");
      } else {
        toast.success(`Einladung an ${customerEmail} versendet`);
      }
    } catch (err) {
      toast.error("Einladung fehlgeschlagen", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleInvite}
            disabled={loading}
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Kundenkonto einladen</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}