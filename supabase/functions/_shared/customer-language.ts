// Customer-language helpers for outbound emails.
// Rule: DE → only German; EN → only English; IT/FR (and any future language)
// → primary language with English as a secondary block.

export type CustomerLang = 'de' | 'en' | 'it' | 'fr';

/** Resolve the customer_language for a given v2_event/inquiry id. Falls back to 'de'. */
export async function resolveCustomerLanguage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  inquiryId: string,
): Promise<CustomerLang> {
  if (!inquiryId) return 'de';
  try {
    const { data } = await supabase
      .from('v2_events')
      .select('customer_language')
      .eq('id', inquiryId)
      .maybeSingle();
    const lang = (data?.customer_language || 'de').toString().toLowerCase();
    if (lang === 'de' || lang === 'en' || lang === 'it' || lang === 'fr') return lang;
  } catch (_e) { /* ignore */ }
  return 'de';
}

/**
 * Returns the language layout for an email:
 * - DE → { primary: 'de', secondary: null }
 * - EN → { primary: 'en', secondary: null }
 * - Any other (IT, FR, …) → { primary: <lang>, secondary: 'en' }
 */
export function emailLanguagePlan(lang: CustomerLang): {
  primary: CustomerLang;
  secondary: CustomerLang | null;
} {
  if (lang === 'de') return { primary: 'de', secondary: null };
  if (lang === 'en') return { primary: 'en', secondary: null };
  return { primary: lang, secondary: 'en' };
}

/** Compose a bilingual subject following the email-language plan. */
export function bilingualSubject(
  lang: CustomerLang,
  subjects: Record<CustomerLang, string>,
): string {
  const plan = emailLanguagePlan(lang);
  if (!plan.secondary) return subjects[plan.primary];
  return `${subjects[plan.primary]} / ${subjects[plan.secondary]}`;
}

/** HTML separator between primary and secondary language blocks. */
export const BILINGUAL_SEPARATOR_HTML = `
<tr><td style="padding: 8px 32px;">
  <hr style="border: 0; border-top: 1px dashed #d9d2c5; margin: 0;" />
</td></tr>
`;