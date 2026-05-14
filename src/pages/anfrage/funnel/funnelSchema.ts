import { z } from "zod";

export const intentSchema = z.object({
  intent: z.enum(["inhouse", "delivery", "consult"], {
    errorMap: () => ({ message: "Bitte auswählen." }),
  }),
});

export const occasionSchema = z.object({
  occasion: z.enum(["geburtstag", "firmenfeier", "hochzeit", "weihnachtsfeier", "privat", "sonstiges"], {
    errorMap: () => ({ message: "Bitte Anlass wählen." }),
  }),
  occasion_other: z.string().trim().max(120).optional().default(""),
  people_bucket: z.enum(["2-10", "11-25", "26-50", "51-100", "100+"], {
    errorMap: () => ({ message: "Bitte Personenzahl wählen." }),
  }),
}).superRefine((v, ctx) => {
  if (v.occasion === "sonstiges" && !v.occasion_other.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["occasion_other"], message: "Bitte kurz beschreiben." });
  }
});

export const dateSchema = z.object({
  date_mode: z.enum(["fixed", "flexible", "open"], {
    errorMap: () => ({ message: "Bitte Variante wählen." }),
  }),
  date_value: z.string().optional().default(""),
  date_range_start: z.string().optional().default(""),
  date_range_end: z.string().optional().default(""),
}).superRefine((v, ctx) => {
  if (v.date_mode === "fixed" && !v.date_value) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date_value"], message: "Bitte Datum wählen." });
  }
  if (v.date_mode === "flexible") {
    if (!v.date_range_start || !v.date_range_end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date_range_start"], message: "Bitte Zeitraum angeben." });
    } else if (v.date_range_end < v.date_range_start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date_range_end"], message: "Ende liegt vor dem Start." });
    }
  }
});

export const formatSchema = z.object({
  format: z.enum([
    "a_la_carte", "3_gaenge", "aperitivo_flying_buffet", "exklusivmiete",
    "fingerfood", "pizza_napoletana", "warme_auflaeufe", "komplett_buffet", "beratung",
  ], { errorMap: () => ({ message: "Bitte Format wählen." }) }),
});

export const contactSchema = z.object({
  first_name: z.string().trim().min(1, "Vorname fehlt").max(80),
  last_name: z.string().trim().min(1, "Nachname fehlt").max(80),
  email: z.string().trim().email("Bitte gültige E-Mail-Adresse").max(200),
  phone: z.string().trim().max(40).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  gdpr_consent: z.literal(true, {
    errorMap: () => ({ message: "Bitte Datenschutz bestätigen." }),
  }),
});