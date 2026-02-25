import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  Receipt, FileCheck, RefreshCw, ExternalLink, Plus,
  Download, Loader2, Link2, X, Eye
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLexOfficeVouchers, useSyncLexOfficePaymentStatus, LexOfficeVoucher } from "@/hooks/useLexOfficeVouchers";
import { InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/admin/shared/InvoiceStatusBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreateManualInvoiceDialog } from "./CreateManualInvoiceDialog";
import { usePermissions } from "@/hooks/usePermissions";

type VoucherType = 'invoice' | 'quotation' | 'creditnote' | 'all';
type VoucherStatus = 'open' | 'paid' | 'overdue' | 'voided' | 'draft' | null;
type PageMode = 'invoices' | 'quotations';

interface LexOfficeInvoicesListProps {
  mode?: PageMode;
}

export const LexOfficeInvoicesList = ({ mode = 'invoices' }: LexOfficeInvoicesListProps) => {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const isQuotationsMode = mode === 'quotations';

  // Typ-Filter: auf Seite "Angebote" immer quotation, auf "Rechnungen" invoice/creditnote/all
  const [typeFilter, setTypeFilter] = useState<VoucherType>(
    isQuotationsMode ? 'quotation' : 'all'
  );
  const [statusFilter, setStatusFilter] = useState<VoucherStatus>(null);
  const [maestroOnly, setMaestroOnly] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Inline PDF Preview
  const [previewVoucher, setPreviewVoucher] = useState<LexOfficeVoucher | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewFilename, setPreviewFilename] = useState('');

  const effectiveTypeFilter = isQuotationsMode ? 'quotation' : typeFilter;

  const vouchersQuery = useLexOfficeVouchers({
    voucherType: effectiveTypeFilter,
    voucherStatus: statusFilter || undefined,
    size: 100,
  });

  const syncMutation = useSyncLexOfficePaymentStatus();

  const allVouchers = vouchersQuery.data?.content || [];
  // Auf der Rechnungen-Seite Angebote ausfiltern (clientseitig)
  const filteredVouchers = isQuotationsMode
    ? allVouchers
    : typeFilter === 'all'
      ? allVouchers.filter(v => v.voucherType !== 'quotation')
      : allVouchers;
  const vouchers = maestroOnly ? filteredVouchers.filter(v => v.localOrderId) : filteredVouchers;
  const isLoading = vouchersQuery.isLoading;
  const totalCount = vouchers.length;

  // Type-Filter nur auf Rechnungen-Seite (ohne Angebote-Option)
  const typeFilterPills = isQuotationsMode ? [] : [
    { id: 'all', label: 'Alle', value: 'all', active: typeFilter === 'all' },
    { id: 'invoice', label: 'Rechnungen', value: 'invoice', active: typeFilter === 'invoice' },
    { id: 'creditnote', label: 'Gutschriften', value: 'creditnote', active: typeFilter === 'creditnote' },
  ];

  const statusFilterPills = [
    { id: 'all-status', label: 'Alle Status', value: '', active: !statusFilter },
    { id: 'open', label: 'Offen', value: 'open', active: statusFilter === 'open' },
    ...(isQuotationsMode ? [] : [
      { id: 'paid', label: 'Bezahlt', value: 'paid', active: statusFilter === 'paid' },
      { id: 'overdue', label: 'Überfällig', value: 'overdue', active: statusFilter === 'overdue' },
    ]),
  ];

  const handleTypeFilterChange = (filterId: string, value: string) => {
    setTypeFilter(value as VoucherType || 'all');
  };

  const handleStatusFilterChange = (filterId: string, value: string) => {
    setStatusFilter(value ? value as VoucherStatus : null);
  };

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync(undefined);
      if (result.updated > 0) {
        toast.success(`${result.updated} von ${result.processed} Dokumenten aktualisiert`);
      } else {
        toast.info(`Keine Änderungen - ${result.processed} Dokumente geprüft`);
      }
      vouchersQuery.refetch();
    } catch (error) {
      toast.error("Fehler bei der Synchronisation");
    }
  };

  const fetchPdf = useCallback(async (voucher: LexOfficeVoucher): Promise<{ url: string; filename: string } | null> => {
    const { data, error } = await supabase.functions.invoke('get-lexoffice-document-by-id', {
      body: { voucherId: voucher.id, voucherType: voucher.voucherType },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const blob = new Blob(
      [Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))],
      { type: 'application/pdf' }
    );
    const url = URL.createObjectURL(blob);
    const filename = data.filename || `${voucher.voucherNumber}.pdf`;
    return { url, filename };
  }, []);

  const handleDownloadPdf = async (voucher: LexOfficeVoucher) => {
    setDownloadingId(voucher.id);
    try {
      const result = await fetchPdf(voucher);
      if (!result) return;
      const a = document.createElement('a');
      a.href = result.url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(result.url);
    } catch (err) {
      toast.error("PDF konnte nicht heruntergeladen werden");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRowClick = async (voucher: LexOfficeVoucher) => {
    // PDF inline anzeigen
    setPreviewVoucher(voucher);
    setPreviewLoading(true);
    setPreviewPdfUrl(null);
    try {
      const result = await fetchPdf(voucher);
      if (result) {
        setPreviewPdfUrl(result.url);
        setPreviewFilename(result.filename);
      }
    } catch (err) {
      toast.error("PDF konnte nicht geladen werden");
      setPreviewVoucher(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
    setPreviewVoucher(null);
    setPreviewPdfUrl(null);
    setPreviewFilename('');
  };

  const handlePreviewDownload = () => {
    if (!previewPdfUrl || !previewFilename) return;
    const a = document.createElement('a');
    a.href = previewPdfUrl;
    a.download = previewFilename;
    a.click();
  };

  const columns: ColumnDef<LexOfficeVoucher>[] = [
    {
      accessorKey: "voucherNumber",
      header: "Nummer",
      cell: ({ row }) => (
        <div>
          <p className="font-mono font-medium">{row.original.voucherNumber}</p>
          {row.original.localOrderNumber && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              {row.original.localOrderNumber}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "voucherDate",
      header: "Datum",
      cell: ({ row }) => {
        const date = row.original.voucherDate;
        if (!date) return <span className="text-muted-foreground">-</span>;
        return (
          <span>{format(parseISO(date), "dd.MM.yyyy", { locale: de })}</span>
        );
      },
    },
    // Typ-Spalte nur auf Rechnungen-Seite (Angebote-Seite hat nur einen Typ)
    ...(!isQuotationsMode ? [{
      accessorKey: "voucherType",
      header: "Typ",
      cell: ({ row }: { row: { original: LexOfficeVoucher } }) => (
        <InvoiceTypeBadge type={row.original.voucherType} />
      ),
    } as ColumnDef<LexOfficeVoucher>] : []),
    {
      accessorKey: "contactName",
      header: "Kunde",
      cell: ({ row }) => (
        <p className="font-medium max-w-[200px] truncate" title={row.original.contactName}>
          {row.original.contactName}
        </p>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: "Betrag",
      cell: ({ row }) => (
        <p className="font-semibold">
          {row.original.totalAmount?.toLocaleString('de-DE', {
            style: 'currency',
            currency: row.original.currency || 'EUR'
          })}
        </p>
      ),
    },
    {
      accessorKey: "voucherStatus",
      header: "Status",
      cell: ({ row }) => (
        <InvoiceStatusBadge status={row.original.voucherStatus} />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleRowClick(row.original);
            }}
            title="PDF anzeigen"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadPdf(row.original);
            }}
            disabled={downloadingId === row.original.id}
            title="PDF herunterladen"
          >
            {downloadingId === row.original.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://app.lexoffice.de/permalink/${row.original.id}`, '_blank');
            }}
            title="In LexOffice öffnen"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const pageTitle = isQuotationsMode ? 'Angebote' : 'Rechnungen';
  const pageDescription = isQuotationsMode
    ? 'Angebote aus LexOffice'
    : 'Rechnungen und Gutschriften aus LexOffice';
  const PageIcon = isQuotationsMode ? FileCheck : Receipt;
  const activeTab = isQuotationsMode ? 'quotations' : 'invoices';

  return (
    <AdminLayout activeTab={activeTab}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <PageIcon className="h-6 w-6" />
              {pageTitle}
            </h1>
            <p className="text-muted-foreground">
              {pageDescription}
              {totalCount > 0 && <span className="ml-1">({totalCount} Dokumente)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Status synchronisieren
            </Button>
            {isAdmin && !isQuotationsMode && (
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Rechnung erstellen
              </Button>
            )}
          </div>
        </div>

        {/* Source + Type Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={maestroOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setMaestroOnly(!maestroOnly)}
          >
            {maestroOnly ? "Nur Maestro" : "Alle LexOffice"}
          </Button>
          {typeFilterPills.length > 0 && (
            <>
              <div className="h-5 w-px bg-border" />
              {typeFilterPills.map((pill) => (
                <Button
                  key={pill.id}
                  variant={pill.active ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTypeFilterChange(pill.id, pill.value)}
                >
                  {pill.label}
                </Button>
              ))}
            </>
          )}
        </div>

        <DataTable
          columns={columns}
          data={vouchers}
          searchPlaceholder="Suche nach Nummer, Kunde..."
          filterPills={statusFilterPills}
          onFilterChange={handleStatusFilterChange}
          onRefresh={() => vouchersQuery.refetch()}
          onRowClick={handleRowClick}
          isLoading={isLoading}
          pageSize={20}
        />

        {vouchersQuery.data?.error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
            <p className="font-medium">Fehler beim Laden</p>
            <p className="text-sm">{vouchersQuery.data.error}</p>
            {(vouchersQuery.data as any)?.details && (
              <p className="text-xs mt-1 opacity-70">{(vouchersQuery.data as any).details}</p>
            )}
          </div>
        )}
      </div>

      {/* Inline PDF Preview Dialog */}
      <Dialog open={!!previewVoucher} onOpenChange={(open) => { if (!open) handleClosePreview(); }}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b shrink-0">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-semibold truncate">
                {previewVoucher?.voucherNumber} — {previewVoucher?.contactName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {previewVoucher?.voucherDate && format(parseISO(previewVoucher.voucherDate), "dd.MM.yyyy", { locale: de })}
                {' · '}
                {previewVoucher?.totalAmount?.toLocaleString('de-DE', { style: 'currency', currency: previewVoucher?.currency || 'EUR' })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviewDownload}
                disabled={!previewPdfUrl}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://app.lexoffice.de/permalink/${previewVoucher?.id}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                LexOffice
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewLoading && (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {previewPdfUrl && !previewLoading && (
              <iframe
                src={previewPdfUrl}
                className="w-full h-full border-0"
                title="PDF Vorschau"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CreateManualInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => vouchersQuery.refetch()}
      />
    </AdminLayout>
  );
};
