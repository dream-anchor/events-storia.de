import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InquiryAttachmentRow {
  id: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  source: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface UseInquiryAttachmentsResult {
  attachments: InquiryAttachmentRow[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  getSignedUrl: (attachmentId: string) => Promise<string>;
}

export function useInquiryAttachments(
  inquiryId: string | null | undefined,
): UseInquiryAttachmentsResult {
  const [attachments, setAttachments] = useState<InquiryAttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!inquiryId) {
      setAttachments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("inquiry_attachments")
        .select(
          "id, original_filename, mime_type, size_bytes, source, uploaded_by, created_at",
        )
        .eq("inquiry_id", inquiryId)
        .order("created_at", { ascending: true });
      if (qErr) throw qErr;
      setAttachments((data ?? []) as InquiryAttachmentRow[]);
    } catch {
      setError("Anhänge konnten nicht geladen werden.");
      setAttachments([]);
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const getSignedUrl = useCallback(async (attachmentId: string) => {
    const { data, error: fnErr } = await supabase.functions.invoke(
      "ai-intake-signed-download",
      { body: { attachmentId } },
    );
    if (fnErr) throw new Error("Download-Link konnte nicht erstellt werden.");
    const url = (data as { signedUrl?: string } | null)?.signedUrl;
    if (!url) throw new Error("Download-Link konnte nicht erstellt werden.");
    return url;
  }, []);

  return { attachments, loading, error, reload: load, getSignedUrl };
}