import { supabase } from "@/integrations/supabase/client";

export interface InquiryDocumentMeta {
  documentId: string | null;
  documentType: "invoice" | "quotation" | null;
}

export async function fetchLatestInquiryDocument(inquiryId: string): Promise<InquiryDocumentMeta> {
  // Priorität: Schlussrechnung > Anzahlungs-/Standardrechnung > Angebot
  const { data, error } = await (supabase as any)
    .from("v2_events")
    .select("final_lexoffice_invoice_id, invoice_lexoffice_id, lexoffice_quotation_id, lexoffice_document_type")
    .eq("id", inquiryId)
    .maybeSingle();

  if (error) throw error;

  const row = data as {
    final_lexoffice_invoice_id?: string | null;
    invoice_lexoffice_id?: string | null;
    lexoffice_quotation_id?: string | null;
    lexoffice_document_type?: "invoice" | "quotation" | null;
  } | null;

  if (row?.final_lexoffice_invoice_id) {
    return { documentId: row.final_lexoffice_invoice_id, documentType: "invoice" };
  }
  if (row?.invoice_lexoffice_id) {
    return {
      documentId: row.invoice_lexoffice_id,
      documentType: (row.lexoffice_document_type as "invoice" | "quotation") || "invoice",
    };
  }
  if (row?.lexoffice_quotation_id) {
    return { documentId: row.lexoffice_quotation_id, documentType: "quotation" };
  }
  return { documentId: null, documentType: null };
}