import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2, Plus, Trash2, Receipt, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useCreateManualInvoice, ManualInvoiceRequest } from "@/hooks/useLexOfficeVouchers";

interface LineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface PrefillData {
  contactName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    zip?: string;
    city?: string;
  };
  eventInquiryId?: string;
}

interface CreateManualInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillData?: PrefillData;
  onSuccess?: () => void;
}

export function CreateManualInvoiceDialog({
  open,
  onOpenChange,
  prefillData,
  onSuccess,
}: CreateManualInvoiceDialogProps) {
  const createInvoiceMutation = useCreateManualInvoice();

  const [documentType, setDocumentType] = useState<'invoice' | 'quotation'>('quotation');
  const [items, setItems] = useState<LineItem[]>([
    { name: '', quantity: 1, unitPrice: 0, taxRate: 7 }
  ]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      contactName: '',
      companyName: '',
      email: '',
      phone: '',
      street: '',
      zip: '',
      city: '',
      introduction: '',
      remark: '',
    }
  });

  // Reset form when dialog opens with prefill data
  useEffect(() => {
    if (open && prefillData) {
      reset({
        contactName: prefillData.contactName || '',
        companyName: prefillData.companyName || '',
        email: prefillData.email || '',
        phone: prefillData.phone || '',
        street: prefillData.address?.street || '',
        zip: prefillData.address?.zip || '',
        city: prefillData.address?.city || '',
        introduction: '',
        remark: '',
      });
    }
  }, [open, prefillData, reset]);

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unitPrice: 0, taxRate: 7 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  };

  const onSubmit = async (data: any) => {
    // Validate items
    const validItems = items.filter(item => item.name.trim() && item.unitPrice > 0);
    if (validItems.length === 0) {
      toast.error("Bitte mindestens eine Position mit Name und Preis hinzufügen");
      return;
    }

    const request: ManualInvoiceRequest = {
      contactName: data.contactName,
      companyName: data.companyName || undefined,
      email: data.email,
      phone: data.phone || undefined,
      address: data.street ? {
        street: data.street,
        zip: data.zip,
        city: data.city,
      } : undefined,
      items: validItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
      })),
      eventInquiryId: prefillData?.eventInquiryId,
      documentType,
      introduction: data.introduction || undefined,
      remark: data.remark || undefined,
    };

    try {
      const result = await createInvoiceMutation.mutateAsync(request);
      if (result.success) {
        toast.success(result.message || `${documentType === 'invoice' ? 'Rechnung' : 'Angebot'} erstellt`);
        onOpenChange(false);
        onSuccess?.();
        // Reset form
        reset();
        setItems([{ name: '', quantity: 1, unitPrice: 0, taxRate: 7 }]);
      } else {
        toast.error(result.error || "Fehler beim Erstellen");
      }
    } catch (error) {
      toast.error("Fehler beim Erstellen des Dokuments");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            {documentType === 'invoice' ? 'Rechnung' : 'Angebot'} erstellen
          </DialogTitle>
          <DialogDescription>
            Erstelle ein neues Dokument in LexOffice
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Document Type */}
          <div className="space-y-2">
            <Label>Dokumenttyp</Label>
            <Select value={documentType} onValueChange={(v) => setDocumentType(v as 'invoice' | 'quotation')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quotation">
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Angebot
                  </span>
                </SelectItem>
                <SelectItem value="invoice">
                  <span className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Rechnung
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer Details */}
          <div className="space-y-4">
            <h3 className="font-medium">Kundendaten</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Name *</Label>
                <Input
                  id="contactName"
                  {...register("contactName", { required: "Name ist erforderlich" })}
                  placeholder="Max Mustermann"
                />
                {errors.contactName && (
                  <p className="text-sm text-destructive">{errors.contactName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Firma</Label>
                <Input
                  id="companyName"
                  {...register("companyName")}
                  placeholder="Musterfirma GmbH"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email", { required: "E-Mail ist erforderlich" })}
                  placeholder="max@beispiel.de"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="+49 89 123456"
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h3 className="font-medium">Adresse (optional)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3 space-y-2">
                <Label htmlFor="street">Straße</Label>
                <Input
                  id="street"
                  {...register("street")}
                  placeholder="Musterstraße 123"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">PLZ</Label>
                <Input
                  id="zip"
                  {...register("zip")}
                  placeholder="80333"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="city">Stadt</Label>
                <Input
                  id="city"
                  {...register("city")}
                  placeholder="München"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Positionen</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Position
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-end gap-2 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Bezeichnung</Label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(index, 'name', e.target.value)}
                      placeholder="z.B. Catering-Service"
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-xs">Menge</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Preis (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitPrice || ''}
                      onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs">MwSt.</Label>
                    <Select
                      value={item.taxRate.toString()}
                      onValueChange={(v) => updateItem(index, 'taxRate', parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7%</SelectItem>
                        <SelectItem value="19">19%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                Summe: {calculateTotal().toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </p>
              <p className="text-xs text-muted-foreground">(Bruttopreise inkl. MwSt.)</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-4">
            <h3 className="font-medium">Notizen (optional)</h3>
            <div className="space-y-2">
              <Label htmlFor="introduction">Einleitung</Label>
              <Textarea
                id="introduction"
                {...register("introduction")}
                placeholder="Wird am Anfang des Dokuments angezeigt..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remark">Schlussbemerkung</Label>
              <Textarea
                id="remark"
                {...register("remark")}
                placeholder="Wird am Ende des Dokuments angezeigt..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={createInvoiceMutation.isPending}>
              {createInvoiceMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {documentType === 'invoice' ? 'Rechnung' : 'Angebot'} erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
