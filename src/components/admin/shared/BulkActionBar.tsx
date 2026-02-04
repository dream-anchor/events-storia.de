import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, UserPlus, Archive, Trash2, Loader2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InquiryPriority } from "@/types/refine";

// Team members for assignment
const TEAM_MEMBERS = [
  { email: "monot@hey.com", name: "Antoine" },
  { email: "mimmo2905@yahoo.de", name: "Domenico" },
  { email: "nicola@storia.de", name: "Nicola" },
  { email: "madi@events-storia.de", name: "Madina" },
];

interface BulkActionBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export function BulkActionBar({
  selectedIds,
  onClearSelection,
  onActionComplete,
}: BulkActionBarProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const count = selectedIds.length;

  if (count === 0) return null;

  const handleBulkStatusChange = async (status: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("event_inquiries")
        .update({ status, updated_at: new Date().toISOString() })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`${count} Anfragen als "${status}" markiert`);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Bulk status update error:", error);
      toast.error("Fehler beim Aktualisieren");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkAssign = async (email: string, name: string) => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from("event_inquiries")
        .update({
          assigned_to: email,
          assigned_at: new Date().toISOString(),
          assigned_by: user?.email,
        })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`${count} Anfragen an ${name} zugewiesen`);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Bulk assign error:", error);
      toast.error("Fehler beim Zuweisen");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkPriority = async (priority: InquiryPriority) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("event_inquiries")
        .update({ priority })
        .in("id", selectedIds);

      if (error) throw error;

      const labels: Record<InquiryPriority, string> = {
        normal: "Normal",
        high: "Hoch",
        urgent: "Dringend",
      };
      toast.success(`${count} Anfragen auf "${labels[priority]}" gesetzt`);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Bulk priority error:", error);
      toast.error("Fehler beim Setzen der Priorität");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkArchive = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("event_inquiries")
        .update({ status: "declined" })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`${count} Anfragen archiviert`);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Bulk archive error:", error);
      toast.error("Fehler beim Archivieren");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="flex items-center gap-3 bg-background border rounded-2xl shadow-lg px-4 py-3">
          {/* Count Badge */}
          <Badge variant="secondary" className="font-mono">
            {count} ausgewählt
          </Badge>

          {/* Divider */}
          <div className="h-6 w-px bg-border" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Mark as Contacted */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleBulkStatusChange("contacted")}
              disabled={isProcessing}
              className="gap-1.5"
            >
              <Phone className="h-4 w-4" />
              Kontaktiert
            </Button>

            {/* Assign Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isProcessing}
                  className="gap-1.5"
                >
                  <UserPlus className="h-4 w-4" />
                  Zuweisen
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {TEAM_MEMBERS.map((member) => (
                  <DropdownMenuItem
                    key={member.email}
                    onClick={() => handleBulkAssign(member.email, member.name)}
                  >
                    {member.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Priority Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isProcessing}
                  className="gap-1.5"
                >
                  <Flag className="h-4 w-4" />
                  Priorität
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleBulkPriority("urgent")}>
                  🔴 Dringend
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkPriority("high")}>
                  🟠 Hoch
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkPriority("normal")}>
                  ⚪ Normal
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Archive */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulkArchive}
              disabled={isProcessing}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Archive className="h-4 w-4" />
              Archivieren
            </Button>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border" />

          {/* Loading or Cancel */}
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClearSelection}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
