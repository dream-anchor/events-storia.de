import { useState } from "react";
import { Info, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface StaffNoteProps {
  note: string;
  onNoteChange: (note: string) => void;
}

export const StaffNote = ({ note, onNoteChange }: StaffNoteProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localNote, setLocalNote] = useState(note);

  const handleSave = () => {
    onNoteChange(localNote);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalNote(note);
    setIsEditing(false);
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4">
      <div className="flex gap-3">
        <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-primary">Interne Notiz</p>
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-6 px-2 text-xs text-primary hover:text-primary"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Bearbeiten
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={localNote}
                onChange={(e) => setLocalNote(e.target.value)}
                placeholder="Interne Notizen für das Team..."
                className="min-h-[80px] text-sm bg-white dark:bg-gray-900 border-primary/20"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-7"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  className="h-7"
                >
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Speichern
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {note || "Keine Notizen vorhanden. Klicken Sie auf 'Bearbeiten', um eine Notiz hinzuzufügen."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
