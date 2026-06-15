import { supabase } from "@/integrations/supabase/client";
import type { AiAttachmentDraft } from "./types";

export interface UploadResult {
  attachmentId: string;
  storagePath: string;
}

/**
 * Uploads a single attachment via the ai-intake-upload-url edge function.
 * Requires a valid conversationId. The browser never touches Storage directly
 * without a signed URL produced by the edge function.
 */
export async function uploadAttachmentWithConversation(
  conversationId: string,
  draft: AiAttachmentDraft,
): Promise<UploadResult> {
  const { data, error } = await supabase.functions.invoke(
    "ai-intake-upload-url",
    {
      body: {
        conversationId,
        filename: draft.file.name,
        mimeType: draft.mime,
        sizeBytes: draft.size,
      },
    },
  );
  if (error) throw new Error(error.message || "upload_url_failed");
  const payload = data as {
    attachmentId?: string;
    storagePath?: string;
    signedUploadUrl?: string;
  };
  if (!payload?.signedUploadUrl || !payload.attachmentId || !payload.storagePath) {
    throw new Error("invalid_upload_response");
  }
  const putRes = await fetch(payload.signedUploadUrl, {
    method: "PUT",
    headers: { "Content-Type": draft.mime },
    body: draft.file,
  });
  if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`);
  return {
    attachmentId: payload.attachmentId,
    storagePath: payload.storagePath,
  };
}