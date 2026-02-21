import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { OfferPhase } from "./types";

interface SendControlsProps {
  offerPhase: OfferPhase;
  emailDraft: string;
  activeOptionsCount: number;
  isSending: boolean;
  onSendProposal: (emailContent: string) => Promise<void>;
  onSendFinalOffer: (emailContent: string) => Promise<void>;
  hasHistory?: boolean;
}

const PHASE_LABELS: Record<OfferPhase, string> = {
  draft: 'Entwurf',
  proposal_sent: 'Vorschlag gesendet',
  customer_responded: 'Kunde hat geantwortet',
  final_draft: 'Finales Angebot (Entwurf)',
  final_sent: 'Finales Angebot gesendet',
  confirmed: 'Bestätigt',
  paid: 'Bezahlt',
};

export function SendControls({
  offerPhase,
  emailDraft,
  activeOptionsCount,
  isSending,
  onSendProposal,
  onSendFinalOffer,
  hasHistory = false,
}: SendControlsProps) {
  const [confirmType, setConfirmType] = useState<'proposal' | 'final' | null>(null);

  const canSendProposal =
    (offerPhase === 'draft' || offerPhase === 'proposal_sent') &&
    activeOptionsCount > 0 &&
    emailDraft.trim().length > 0;

  const canSendFinal =
    (offerPhase === 'customer_responded' || offerPhase === 'final_draft') &&
    activeOptionsCount > 0 &&
    emailDraft.trim().length > 0;

  const handleConfirm = async () => {
    if (confirmType === 'proposal') {
      await onSendProposal(emailDraft);
    } else if (confirmType === 'final') {
      await onSendFinalOffer(emailDraft);
    }
    setConfirmType(null);
  };

  // Zeige Phase-Indicator
  const showProposal = offerPhase === 'draft' || offerPhase === 'proposal_sent';
  const showFinal = offerPhase === 'customer_responded' || offerPhase === 'final_draft';
  const isDone = offerPhase === 'final_sent' || offerPhase === 'confirmed' || offerPhase === 'paid';

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Phase-Indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
          <div className={cn(
            "h-2 w-2 rounded-full",
            offerPhase === 'draft' && "bg-gray-400",
            offerPhase === 'proposal_sent' && "bg-amber-500",
            offerPhase === 'customer_responded' && "bg-blue-500",
            (offerPhase === 'final_draft' || offerPhase === 'final_sent') && "bg-green-500",
            (offerPhase === 'confirmed' || offerPhase === 'paid') && "bg-emerald-500",
          )} />
          <span>{PHASE_LABELS[offerPhase]}</span>
        </div>

        {/* Done-State */}
        {isDone && (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Angebot wurde versendet</span>
          </div>
        )}

        {/* Vorschlag senden (Phase 1) */}
        {showProposal && (
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              onClick={() => setConfirmType('proposal')}
              disabled={!canSendProposal || isSending}
              className={cn(
                "h-11 rounded-xl font-semibold gap-2 px-6",
                "bg-gradient-to-r from-amber-500 to-amber-600",
                "text-white hover:from-amber-600 hover:to-amber-700",
                "shadow-[0_4px_16px_-4px_rgba(245,158,11,0.4)]",
                "disabled:opacity-50 disabled:shadow-none"
              )}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {offerPhase === 'proposal_sent' ? 'Erneut senden' : hasHistory ? 'Neuen Vorschlag senden' : 'Vorschlag senden'}
            </Button>
          </motion.div>
        )}

        {/* Finales Angebot senden (Phase 2) */}
        {showFinal && (
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button
              onClick={() => setConfirmType('final')}
              disabled={!canSendFinal || isSending}
              className={cn(
                "h-11 rounded-xl font-semibold gap-2 px-6",
                "bg-gradient-to-r from-emerald-500 to-emerald-600",
                "text-white hover:from-emerald-600 hover:to-emerald-700",
                "shadow-[0_4px_16px_-4px_rgba(16,185,129,0.4)]",
                "disabled:opacity-50 disabled:shadow-none"
              )}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Finales Angebot senden
            </Button>
          </motion.div>
        )}
      </div>

      {/* Bestätigung */}
      <AlertDialog open={confirmType !== null} onOpenChange={() => setConfirmType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmType === 'proposal' ? 'Vorschlag senden?' : 'Finales Angebot senden?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmType === 'proposal'
                ? `${activeOptionsCount} Option${activeOptionsCount !== 1 ? 'en' : ''} werden dem Kunden als Vorschlag geschickt. Der Kunde kann eine Option wählen und Anmerkungen machen.`
                : `Das finale Angebot wird mit Zahlungslink an den Kunden geschickt. Stripe Payment Links werden generiert.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                confirmType === 'proposal'
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-emerald-500 hover:bg-emerald-600"
              )}
            >
              {confirmType === 'proposal' ? 'Vorschlag senden' : 'Finales Angebot senden'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
