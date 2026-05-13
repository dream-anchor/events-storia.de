import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Printer, ChefHat, ConciergeBell, FileText } from 'lucide-react';
import { PrintPreviewDialog, type PrintSheetType } from './PrintPreviewDialog';

export function PrintMenu({ inquiryId }: { inquiryId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PrintSheetType | null>(null);

  const trigger = (t: PrintSheetType) => { setType(t); setOpen(true); };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Printer className="h-4 w-4" /> Drucken
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
      <PrintPreviewDialog
        open={open}
        type={type}
        inquiryIds={[inquiryId]}
        onClose={() => setOpen(false)}
      />
    </>
  );
}