import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Printer } from 'lucide-react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { saveAs } from 'file-saver';
import { format, addDays, addMonths, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { UpcomingOrdersSheet, type GroupBy, type LocationScope } from './UpcomingOrdersSheet';
import type { InquiryRecord } from '@/types/inquiryRecord';
import { getLifecycleBucket } from '@/types/inquiryRecord';

interface Props {
  open: boolean;
  onClose: () => void;
  records: InquiryRecord[];
  generatedBy?: string;
}

export function UpcomingOrdersPrintDialog({ open, onClose, records, generatedBy }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>('week');
  const [scope, setScope] = useState<LocationScope>('both');
  const [includeOpen, setIncludeOpen] = useState(false);
  const [rendering, setRendering] = useState(false);

  const { filtered, rangeLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = groupBy === 'week' ? addDays(today, 28) : addMonths(today, 3);
    const list = records.filter((r) => {
      if (!r.date) return false;
      const d = parseISO(r.date);
      if (Number.isNaN(d.getTime())) return false;
      if (d < today || d > end) return false;
      const bucket = getLifecycleBucket(r);
      if (bucket === 'archive') return false;
      if (!includeOpen && bucket !== 'won') return false;
      return true;
    });
    const label = `${format(today, 'dd.MM.', { locale: de })}–${format(end, 'dd.MM.yyyy', { locale: de })}`;
    return { filtered: list, rangeLabel: label };
  }, [records, groupBy, includeOpen]);

  const doc = useMemo(
    () => (
      <UpcomingOrdersSheet
        records={filtered}
        groupBy={groupBy}
        scope={scope}
        rangeLabel={rangeLabel}
        generatedBy={generatedBy}
      />
    ),
    [filtered, groupBy, scope, rangeLabel, generatedBy],
  );

  useEffect(() => {
    if (!open) {
      setRendering(false);
    }
  }, [open]);

  const handleDownload = async () => {
    setRendering(true);
    try {
      const blob = await pdf(doc).toBlob();
      const today = format(new Date(), 'yyyy-MM-dd');
      saveAs(blob, `Naechste-Auftraege_${groupBy === 'week' ? 'Woche' : 'Monat'}_${today}.pdf`);
    } finally {
      setRendering(false);
    }
  };

  const handlePrint = async () => {
    setRendering(true);
    try {
      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) {
        win.addEventListener('load', () => {
          try { win.print(); } catch {}
        });
      }
    } finally {
      setRendering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nächste Aufträge drucken</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-6 px-1 pb-2 border-b">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Zeitraum</Label>
            <ToggleGroup
              type="single"
              value={groupBy}
              onValueChange={(v) => v && setGroupBy(v as GroupBy)}
              className="rounded-2xl bg-muted/60 p-1"
            >
              <ToggleGroupItem value="week" className="rounded-xl px-3 text-xs">
                Woche (4 W.)
              </ToggleGroupItem>
              <ToggleGroupItem value="month" className="rounded-xl px-3 text-xs">
                Monat (3 M.)
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Ort</Label>
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(v) => v && setScope(v as LocationScope)}
              className="rounded-2xl bg-muted/60 p-1"
            >
              <ToggleGroupItem value="both" className="rounded-xl px-3 text-xs">Beides</ToggleGroupItem>
              <ToggleGroupItem value="inhouse" className="rounded-xl px-3 text-xs">In Haus</ToggleGroupItem>
              <ToggleGroupItem value="offsite" className="rounded-xl px-3 text-xs">Außer Haus</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex items-center gap-2 pb-1.5">
            <Switch id="include-open" checked={includeOpen} onCheckedChange={setIncludeOpen} />
            <Label htmlFor="include-open" className="text-xs text-muted-foreground cursor-pointer">
              Offene Angebote einschließen
            </Label>
          </div>

          <div className="ml-auto text-xs text-muted-foreground pb-1.5">
            {filtered.length} Aufträge · {rangeLabel}
          </div>
        </div>

        <div className="flex-1 min-h-0 bg-muted/30 rounded-lg overflow-hidden mt-3">
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            {doc}
          </PDFViewer>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose}>Schließen</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint} disabled={rendering}>
              {rendering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              Drucken
            </Button>
            <Button onClick={handleDownload} disabled={rendering}>
              {rendering ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              PDF herunterladen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}