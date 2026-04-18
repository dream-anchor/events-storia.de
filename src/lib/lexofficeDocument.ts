import { supabase } from "@/integrations/supabase/client";

export interface InquiryDocumentMeta {
  documentId: string | null;
  documentType: "invoice" | "quotation" | null;
}

export async function fetchLatestInquiryDocument(inquiryId: string): Promise<InquiryDocumentMeta> {
  const { data, error } = await supabase
    .from("event_inquiries")
    .select("lexoffice_invoice_id, lexoffice_document_type, lexoffice_quotation_id")
    .eq("id", inquiryId)
    .maybeSingle();

  if (error) throw error;

  const row = data as {
    lexoffice_invoice_id?: string | null;
    lexoffice_document_type?: "invoice" | "quotation" | null;
    lexoffice_quotation_id?: string | null;
  } | null;

  return {
    documentId: row?.lexoffice_invoice_id || row?.lexoffice_quotation_id || null,
    documentType: row?.lexoffice_document_type || (row?.lexoffice_quotation_id ? "quotation" : null),
  };
}