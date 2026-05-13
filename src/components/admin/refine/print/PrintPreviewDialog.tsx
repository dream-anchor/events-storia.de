import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Printer } from 'lucide-react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { fetchPrintInquiries } from '@/lib/print/fetchPrintData';
import type { PrintInquiry } from '@/lib/print/types';
import { KitchenSheet } from './KitchenSheet';
import { ServiceSheet } from './ServiceSheet';
import { FullOrderSheet } from './FullOrderSheet';
import type { PrintSheetType } from './PrintMenu';
export type { PrintSheetType };

const TITLES: Record<PrintSheetType, string> = {
  kitchen: 'Küchenzettel',
  service: 'Service-Laufzettel',
  full: 'Komplettauftrag',
};

function buildDocument(type: PrintSheetType, data: PrintInquiry[]) {
  if (type === 'kitchen') return <KitchenSheet inquiries={data} />;
  if (type === 'service') return <ServiceSheet inquiries={data} />;
  return <FullOrderSheet inquiries={data} />;
}

function buildFilename(type: PrintSheetType, data: PrintInquiry[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const base = type === 'kitchen' ? 'Kuechenzettel' : type === 'service' ? 'Servicezettel' : 'Komplettauftrag';
  if (data.length === 1) return `${base}_${data[0].orderNumber}_${today}.pdf`;
  return `${base}_${data.length}-Anfragen_${today}.pdf`;
}

interface Props {
  open: boolean;
  type: PrintSheetType | null;
  inquiryIds: string[];
  onClose: () => void;
}

export function PrintPreviewDialog({ open, type, inquiryIds, onClose }: Props) {
  const [data, setData] = useState<PrintInquiry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !type || !inquiryIds.length) return;
    let cancelled = false;
    setLoading(true);
    fetchPrintInquiries(inquiryIds)
      .then((d) => { if (!cancelled) setData(d); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, type, inquiryIds.join(',')]);

  const doc = useMemo(() => (type && data ? buildDocument(type, data) : null), [type, data]);

  const handleDownload = async () => {
    if (!type || !data) return;
    const blob = await pdf(buildDocument(type, data)).toBlob();
    saveAs(blob, buildFilename(type, data));
  };

  const handlePrint = async () => {
    if (!type || !data) return;
    const blob = await pdf(buildDocument(type, data)).toBlob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        try { win.print(); } catch {}
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {type ? TITLES[type] : 'Drucken'}
            {data && data.length > 1 ? ` · ${data.length} Anfragen` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30 rounded-lg overflow-hidden">
          {loading || !doc ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Lade Daten…
            </div>
          ) : (
            <PDFViewer width="100%" height="100%" showToolbar={false}>
              {doc}
            </PDFViewer>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose}>Schließen</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} disabled={!data}>
              <Printer className="h-4 w-4 mr-2" /> Drucken
            </Button>
            <Button onClick={handleDownload} disabled={!data}>
              <Download className="h-4 w-4 mr-2" /> PDF herunterladen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}