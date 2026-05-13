import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Printer, ChefHat, ConciergeBell, FileText, Loader2 } from 'lucide-react';
import { useSaveStatus } from '@/components/admin/shared/SaveStatusContext';

export type PrintSheetType = 'kitchen' | 'service' | 'full';
const PrintPreviewDialog = lazy(() =>
  import('./PrintPreviewDialog').then((m) => ({ default: m.PrintPreviewDialog }))
);

export function PrintMenu({ inquiryId }: { inquiryId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PrintSheetType | null>(null);
  const [flushing, setFlushing] = useState(false);
  const { flushAll } = useSaveStatus();

  const trigger = async (t: PrintSheetType) => {
    setType(t);
    // Vor dem Laden: alle Pending-Auto-Saves abschliessen, damit das PDF
    // garantiert die aktuelle Builder-Version zeigt (kein Debounce-Lag).
    setFlushing(true);
    try {
      await flushAll();
    } finally {
      setFlushing(false);
    }
    setOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2" disabled={flushing}>
            {flushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Drucken
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => trigger('kitchen')}>
            <ChefHat className="h-4 w-4 mr-2" /> Küchenzettel
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => trigger('service')}>
            <ConciergeBell className="h-4 w-4 mr-2" /> Service-Laufzettel
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => trigger('full')}>
            <FileText className="h-4 w-4 mr-2" /> Komplettauftrag
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {open && (
        <Suspense fallback={null}>
          <PrintPreviewDialog
            open={open}
            type={type}
            inquiryIds={[inquiryId]}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
}