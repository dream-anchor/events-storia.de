export type AiIntakeLanguage = "de" | "en";

export interface AiIntakeMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
}

export interface AiIntakeExtraction {
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  eventDate?: string | null;
  eventDateRange?: string | null;
  guestCount?: number | null;
  location?: string | null;
  foodWish?: string | null;
  notes?: string | null;
}

export type AiRequiredField = "contactName" | "email" | "eventDate" | "guestCount";

export interface AiAttachmentDraft {
  id: string;
  file: File;
  size: number;
  mime: string;
  ext: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  errorMessage?: string;
  previewUrl?: string;
  // Set once a real upload (with conversationId) succeeded:
  remoteAttachmentId?: string;
  remoteStoragePath?: string;
}

export const AI_ALLOWED_MIME = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const AI_ALLOWED_EXT = new Set<string>([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
  "doc",
  "docx",
]);

export const AI_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const AI_MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const AI_MAX_FILES = 10;

export function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx < 0 || idx === filename.length - 1) return "";
  return filename.slice(idx + 1).toLowerCase();
}