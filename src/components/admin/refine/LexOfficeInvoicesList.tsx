import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import {
  Receipt, RefreshCw, ExternalLink, FileText, Plus,
  Download, Loader2, Link2
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { DataTable } from "./DataTable";
import { Button } from "@/components/ui/button";
import { useLexOfficeVouchers, useSyncLexOfficePaymentStatus, LexOfficeVoucher } from "@/hooks/useLexOfficeVouchers";
import { InvoiceStatusBadge, InvoiceTypeBadge } from "@/components/admin/shared/InvoiceStatusBadge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreateManualInvoiceDialog } from "./CreateManualInvoiceDialog";

type VoucherType = 'invoice' | 'quotation' | 'creditnote' | 'all';
type VoucherStatus = 'open' | 'paid' | 'overdue' | 'voided' | 'draft' | null;

export const LexOfficeInvoicesList = () => {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<VoucherType>('all');
  const [statusFilter, setStatusFilter] = useState<VoucherStatus>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const vouchersQuery = useLexOfficeVouchers({
    voucherType: typeFilter,
    voucherStatus: statusFilter || undefined,
    size: 100,
  });

  const syncMutation = useSyncLexOfficePaymentStatus();

  const vouchers = vouchersQuery.data?.content || [];
  const isLoading = vouchersQuery.isLoading;
  const totalCount = vouchersQuery.data?.totalElements || 0;

  const typeFilterPills = [
    { id: 'all', label: 'Alle', value: 'all', active: typeFilter === 'all' },
    { id: 'invoice', label: 'Rechnungen', value: 'invoice', active: typeFilter === 'invoice' },
    { id: 'quotation', label: 'Angebote', value: 'quotation', active: typeFilter === 'quotation' },
    { id: 'creditnote', label: 'Gutschriften', value: 'creditnote', active: typeFilter === 'creditnote' },
  ];

  const statusFilterPills = [
    { id: 'all-status', label: 'Alle Status', value: '', active: !statusFilter },
    { id: 'open', label: 'Offen', value: 'open', active: statusFilter === 'open' },
    { id: 'paid', label: 'Bezahlt', value: 'paid', active: statusFilter === 'paid' },
    { id: 'overdue', label: 'Überfällig', value: 'overdue', active: statusFilter === 'overdue' },
  ];

  const handleTypeFilterChange = (filterId: string, value: string) => {
    setTypeFilter(value as VoucherType || 'all');
  };

  const handleStatusFilterChange = (filterId: string, value: string) => {
    setStatusFilter(value ? value as VoucherStatus : null);
  };

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
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

  const handleDownloadPdf = async (voucher: LexOfficeVoucher) => {
    setDownloadingId(voucher.id);
    try {
      const { data, error } = await supabase.functions.invoke('get-lexoffice-document-by-id', {
        body: { voucherId: voucher.id, voucherType: voucher.voucherType },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Download base64 PDF
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${data.pdf}`;
      link.download = data.filename || `${voucher.voucherNumber}.pdf`;
      link.click();
    } catch (err) {
      toast.error("PDF konnte nicht heruntergeladen werden");
    } finally {
      setDownloadingId(null);
    }
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
    {
      accessorKey: "voucherType",
      header: "Typ",
      cell: ({ row }) => (
        <InvoiceTypeBadge type={row.original.voucherType} />
      ),
    },
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

  const handleRowClick = (voucher: LexOfficeVoucher) => {
    // If there's a linked local order, navigate to it
    if (voucher.localOrderId) {
      navigate(`/admin/orders/${voucher.localOrderId}/edit`);
    } else {
      // Otherwise open in LexOffice
      window.open(`https://app.lexoffice.de/permalink/${voucher.id}`, '_blank');
    }
  };

  return (
    <AdminLayout activeTab="invoices">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Buchhaltung
            </h1>
            <p className="text-muted-foreground">
              Rechnungen und Angebote aus LexOffice
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
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Rechnung erstellen
            </Button>
          </div>
        </div>

        {/* Type Filter */}
        <div className="flex flex-wrap gap-2">
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
          </div>
        )}
      </div>

      <CreateManualInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => vouchersQuery.refetch()}
      />
    </AdminLayout>
  );
};
