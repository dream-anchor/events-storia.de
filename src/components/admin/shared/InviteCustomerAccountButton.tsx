import { useState } from "react";
import { UserPlus, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";

interface Props {
  customerEmail: string;
  customerName?: string;
  customerId?: string;
  invitedAt?: string | null;
  activatedAt?: string | null;
  onInvited?: () => void;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
}

export function InviteCustomerAccountButton({
  customerEmail, customerName, customerId, invitedAt, activatedAt,
  onInvited, size = "sm", variant = "outline",
}: Props) {
  const [loading, setLoading] = useState(false);

  if (activatedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Kundenkonto aktiv (seit {format(parseISO(activatedAt), "dd.MM.yyyy", { locale: de })})
      </span>
    );
  }

  const handleInvite = async () => {
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
        toast.info("Kunde hat bereits ein Konto", { description: res.error });
      } else {
        toast.success("Einladung versendet", {
          description: `Eine E-Mail wurde an ${customerEmail} gesendet.`,
        });
      }
      onInvited?.();
    } catch (e) {
      toast.error("Einladung fehlgeschlagen", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button size={size} variant={variant} onClick={handleInvite} disabled={loading} className="rounded-xl">
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
        {invitedAt ? "Einladung erneut senden" : "Kundenkonto einladen"}
      </Button>
      {invitedAt && (
        <span className="text-xs text-muted-foreground">
          Eingeladen am {format(parseISO(invitedAt), "dd.MM.yyyy HH:mm", { locale: de })}
        </span>
      )}
    </div>
  );
}