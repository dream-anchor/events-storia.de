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
  companyName?: string | null;
  preferredDate?: string | null;
  dateRange?: string | null;
  timeSlot?: string | null;
  guestCount?: number | null;
  eventType?: string | null;
  locationName?: string | null;
  deliveryAddress?: string | null;
  budget?: string | null;
  foodPreferences?: string[] | null;
  dietaryRequirements?: string[] | null;
  serviceNeeds?: string[] | null;
  equipmentNeeds?: string[] | null;
  summary?: string | null;
  notes?: string | null;
}

export type AiRequiredField =
  | "contactName"
  | "email"
  | "preferredDate"
  | "guestCount";

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