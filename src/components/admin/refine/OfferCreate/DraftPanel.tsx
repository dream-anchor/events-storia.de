import { Save, Send, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactDataCard } from "./ContactDataCard";
import { EventDetailsCard } from "./EventDetailsCard";
import { AISuggestionsCard } from "./AISuggestionsCard";
import { PackageSelectorCard } from "./PackageSelectorCard";
import { DraftFormData, SuggestedPackage, SuggestedItem } from "./types";

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
}: DraftPanelProps) => {
  const handleAddPackageFromSuggestion = (packageName: string) => {
    // This would ideally match with actual package data from the database
    // For now, we add it as a placeholder that will be matched in the selector
    const existingNames = formData.selected_packages.map(p => p.name);
    if (!existingNames.includes(packageName)) {
      // Add placeholder - the real price will be fetched when matched
      onFormChange({
        selected_packages: [
          ...formData.selected_packages,
          { id: `suggested-${Date.now()}`, name: packageName, price: 0 }
        ]
      });
    }
  };

  const handleSearchItem = (term: string) => {
    // Could open a search modal or filter the package list
    console.log('Search for:', term);
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

      <PackageSelectorCard
        selectedPackages={formData.selected_packages}
        onAddPackage={(pkg) => 
          onFormChange({ 
            selected_packages: [...formData.selected_packages, pkg] 
          })
        }
        onRemovePackage={(packageId) =>
          onFormChange({
            selected_packages: formData.selected_packages.filter(p => p.id !== packageId)
          })
        }
      />

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
      <div className="flex gap-3 pt-2 pb-4">
        <Button
          variant="outline"
          onClick={onSaveDraft}
          disabled={!canSave || isSaving || isSending}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Speichern...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Speichern (Entwurf)
            </>
          )}
        </Button>
        <Button
          onClick={onSaveAndSend}
          disabled={!canSave || isSaving || isSending}
          className="flex-1"
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
