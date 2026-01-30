import { useEffect, useMemo } from "react";
import { usePDF } from "@react-pdf/renderer";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Download, Loader2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { QuotePDFDocument } from "../../QuotePDF";
import { ExtendedInquiry, QuoteItem } from "../types";
import { OfferOption } from "./types";
import { Package } from "../types";
import type { EventInquiry } from "@/types/refine";
import type { MenuSelection, CourseSelection, DrinkSelection, CourseType, DrinkGroupType, ItemSource } from "../MenuComposer/types";

interface LivePDFPreviewProps {
  inquiry: ExtendedInquiry;
  options: OfferOption[];
  packages: Package[];
  emailDraft: string;
}

export function LivePDFPreview({
  inquiry,
  options,
  packages,
  emailDraft,
}: LivePDFPreviewProps) {
  // Build line items from options
  const lineItems = useMemo<QuoteItem[]>(() => {
    return options
      .filter((opt) => opt.isActive && opt.packageId)
      .map((opt) => {
        const pkg = packages.find((p) => p.id === opt.packageId);
        if (!pkg) return null;
        
        return {
          id: opt.id,
          name: `Option ${opt.optionLabel}: ${pkg.name}`,
          description: `${opt.guestCount} Gäste`,
          price: pkg.price_per_person ? pkg.price : pkg.price,
          quantity: pkg.price_per_person ? opt.guestCount : 1,
          isPackage: true,
        };
      })
      .filter(Boolean) as QuoteItem[];
  }, [options, packages]);

  // Get first active option's menu selection for PDF - convert to proper type
  const menuSelection = useMemo<MenuSelection | null>(() => {
    const activeOption = options.find((opt) => opt.isActive && opt.packageId);
    if (!activeOption?.menuSelection) return null;
    
    // Convert MenuSelectionType to MenuSelection with proper typing
    const courses: CourseSelection[] = (activeOption.menuSelection.courses || []).map((c) => ({
      courseType: c.courseType as CourseType,
      courseLabel: c.courseLabel,
      itemId: c.itemId,
      itemName: c.itemName,
      itemDescription: c.itemDescription,
      itemSource: c.itemSource as ItemSource,
      isCustom: c.isCustom,
    }));
    
    const drinks: DrinkSelection[] = (activeOption.menuSelection.drinks || []).map((d) => ({
      drinkGroup: d.drinkGroup as DrinkGroupType,
      drinkLabel: d.drinkLabel,
      selectedChoice: d.selectedChoice,
      quantityLabel: d.quantityLabel,
      customDrink: d.customDrink,
    }));
    
    return { courses, drinks };
  }, [options]);

  // Convert ExtendedInquiry to EventInquiry for PDF
  const eventForPdf = useMemo<EventInquiry>(() => ({
    id: inquiry.id,
    company_name: inquiry.company_name,
    contact_name: inquiry.contact_name,
    email: inquiry.email,
    phone: inquiry.phone,
    guest_count: inquiry.guest_count,
    event_type: inquiry.event_type,
    preferred_date: inquiry.preferred_date,
    message: inquiry.message,
    source: inquiry.source,
    status: inquiry.status,
    internal_notes: inquiry.internal_notes,
    notification_sent: inquiry.notification_sent,
    created_at: inquiry.created_at,
    updated_at: inquiry.updated_at,
    last_edited_by: null,
    last_edited_at: null,
    offer_sent_at: null,
    offer_sent_by: null,
  }), [inquiry]);

  // Generate PDF document
  const pdfDocument = useMemo(() => (
    <QuotePDFDocument
      event={eventForPdf}
      items={lineItems}
      notes={emailDraft}
      quoteNumber={`ANF-${inquiry.id?.slice(0, 8).toUpperCase()}`}
      menuSelection={menuSelection}
    />
  ), [eventForPdf, lineItems, emailDraft, inquiry.id, menuSelection]);

  const [pdfInstance, updatePdf] = usePDF({ document: pdfDocument });

  // Debounced update when emailDraft or options change
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePdf(pdfDocument);
    }, 500);
    return () => clearTimeout(timer);
  }, [emailDraft, options, pdfDocument, updatePdf]);

  const handleDownload = () => {
    if (pdfInstance.url) {
      const link = document.createElement("a");
      link.href = pdfInstance.url;
      link.download = `Angebot-${inquiry.contact_name?.replace(/\s+/g, "-")}.pdf`;
      link.click();
    }
  };

  const handleFullscreen = () => {
    if (pdfInstance.url) {
      window.open(pdfInstance.url, "_blank");
    }
  };

  return (
    <Card
      className={cn(
        "flex-1 flex flex-col overflow-hidden",
        "rounded-3xl border-border/30",
        "bg-muted/20 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      )}
    >
      {/* Header with Quick Look styling */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Vorschau</span>
        </div>
        <AnimatePresence mode="wait">
          {pdfInstance.loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Badge variant="outline" className="text-xs gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Aktualisiert…
              </Badge>
            </motion.div>
          ) : (
            <motion.div
              key="live"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Badge
                variant="outline"
                className="text-xs bg-primary/10 text-primary border-primary/20"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-primary mr-1.5 animate-pulse" />
                Live
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* PDF Viewer - Full height */}
      <div className="flex-1 relative min-h-[400px] bg-white/50">
        {/* Loading Overlay */}
        <AnimatePresence>
          {pdfInstance.loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10"
            >
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  PDF wird aktualisiert…
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PDF iframe */}
        {pdfInstance.url ? (
          <iframe
            src={pdfInstance.url}
            className="w-full h-full border-0"
            title="PDF Preview"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 opacity-50" />
              <span className="text-sm">PDF wird generiert…</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer with actions */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-border/30 bg-background/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={!pdfInstance.url || pdfInstance.loading}
          className="h-8 rounded-xl gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFullscreen}
          disabled={!pdfInstance.url || pdfInstance.loading}
          className="h-8 rounded-xl gap-1.5"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          In neuem Tab
        </Button>
      </div>
    </Card>
  );
}
