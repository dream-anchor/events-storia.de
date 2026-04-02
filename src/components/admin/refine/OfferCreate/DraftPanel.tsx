import { Send, Loader2, MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactDataCard } from "./ContactDataCard";
import { EventDetailsCard } from "./EventDetailsCard";
import { AISuggestionsCard } from "./AISuggestionsCard";
import { OfferBuilder } from "../InquiryEditor/OfferBuilder";
import { DraftFormData, SuggestedPackage, SuggestedItem } from "./types";
import type { ExtendedInquiry, Package, EmailTemplate } from "../InquiryEditor/types";

interface DraftPanelProps {
  formData: DraftFormData;
  onFormChange: (updates: Partial<DraftFormData>) => void;
  suggestions: SuggestedPackage[];
  suggestedItems: SuggestedItem[];
  onSaveDraft: () => void;
  onSaveAndSend: () => void;
  isSaving: boolean;
  isSending: boolean;
  hasExtracted: boolean;
  draftInquiry: ExtendedInquiry | null;
  packages: Package[];
  templates: EmailTemplate[];
  onEmailContentChange: (content: string) => void;
}

export const DraftPanel = ({
  formData,
  onFormChange,
  suggestions,
  suggestedItems,
  onSaveDraft,
  onSaveAndSend,
  isSaving,
  isSending,
  hasExtracted,
  draftInquiry,
  packages,
  templates,
  onEmailContentChange,
}: DraftPanelProps) => {
  const handleAddPackageFromSuggestion = (packageName: string) => {
    const existingNames = formData.selected_packages.map(p => p.name);
    if (!existingNames.includes(packageName)) {
      onFormChange({
        selected_packages: [
          ...formData.selected_packages,
          { id: `suggested-${Date.now()}`, name: packageName, price: 0 }
        ]
      });
    }
  };

  const handleSearchItem = (_term: string) => {
    // TODO: Suche in OfferBuilder-DishPicker öffnen
  };

  const addedPackageNames = formData.selected_packages.map(p => p.name);

  const canSave = formData.contact_name.trim() && formData.email.trim();

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Entwurf (Strukturiert)</CardTitle>
        </CardHeader>
      </Card>

      <ContactDataCard
        contactName={formData.contact_name}
        companyName={formData.company_name}
        email={formData.email}
        phone={formData.phone}
        onContactNameChange={(v) => onFormChange({ contact_name: v })}
        onCompanyNameChange={(v) => onFormChange({ company_name: v })}
        onEmailChange={(v) => onFormChange({ email: v })}
        onPhoneChange={(v) => onFormChange({ phone: v })}
      />

      <EventDetailsCard
        preferredDate={formData.preferred_date}
        preferredTime={formData.preferred_time}
        guestCount={formData.guest_count}
        eventType={formData.event_type}
        onPreferredDateChange={(v) => onFormChange({ preferred_date: v })}
        onPreferredTimeChange={(v) => onFormChange({ preferred_time: v })}
        onGuestCountChange={(v) => onFormChange({ guest_count: v })}
        onEventTypeChange={(v) => onFormChange({ event_type: v })}
      />

      {hasExtracted && (
        <AISuggestionsCard
          suggestions={suggestions}
          suggestedItems={suggestedItems}
          addedPackages={addedPackageNames}
          onAddPackage={handleAddPackageFromSuggestion}
          onSearch={handleSearchItem}
        />
      )}

      {/* OfferBuilder — ersetzt PackageSelectorCard */}
      {draftInquiry ? (
        <OfferBuilder
          inquiry={draftInquiry}
          packages={packages}
          templates={templates}
          onSave={async () => {}}
          isCreateMode={true}
          onEmailContentChange={onEmailContentChange}
        />
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
            <span className="text-sm text-muted-foreground">Angebots-Editor wird geladen...</span>
          </CardContent>
        </Card>
      )}

      {/* Notes/Message */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Notizen / Kundenwünsche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Besondere Wünsche, Anmerkungen des Kunden..."
            value={formData.message}
            onChange={(e) => onFormChange({ message: e.target.value })}
            className="min-h-[80px]"
          />
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2 pb-4 items-center">
        {/* Autosave-Indikator statt "Speichern (Entwurf)" */}
        {draftInquiry && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            Angebot wird automatisch gespeichert
          </div>
        )}
        <Button
          onClick={onSaveAndSend}
          disabled={!canSave || isSaving || isSending || !draftInquiry}
          className="flex-1 max-w-[220px]"
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sende...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Speichern & Senden
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
