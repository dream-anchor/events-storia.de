import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trash2, Archive, Mail, X } from "lucide-react";

interface FloatingActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onEmail?: () => void;
}

export const FloatingActionBar = ({
  selectedCount,
  onClear,
  onDelete,
  onArchive,
  onEmail,
}: FloatingActionBarProps) => {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-40"
        >
          <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl">
            <span className="text-sm font-medium">
              {selectedCount} ausgewählt
            </span>
            
            <div className="flex items-center gap-1">
              {onEmail && (
                <Button size="sm" variant="ghost" onClick={onEmail}>
                  <Mail className="h-4 w-4" />
                </Button>
              )}
              {onArchive && (
                <Button size="sm" variant="ghost" onClick={onArchive}>
                  <Archive className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Button size="sm" variant="ghost" onClick={onClear}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
