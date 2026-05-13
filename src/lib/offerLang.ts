export type OfferLang = 'de' | 'en' | 'it' | 'fr';

export const OFFER_LANGS: OfferLang[] = ['de', 'en', 'it', 'fr'];

export const OFFER_LANG_LABELS: Record<OfferLang, string> = {
  de: 'DE',
  en: 'EN',
  it: 'IT',
  fr: 'FR',
};

/**
 * Picks the best matching translation for a snapshot field.
 * Convention: base field is DE, suffixed fields `_en`, `_it`, `_fr`.
 * Fallback chain: requested → en → de.
 */
export function pickLang<T extends Record<string, any>>(
  obj: T | null | undefined,
  field: string,
  lang: OfferLang
): string {
  if (!obj) return '';
  if (lang === 'de') return (obj[field] ?? '') as string;
  const localized = obj[`${field}_${lang}`];
  if (localized) return localized as string;
  const en = obj[`${field}_en`];
  if (lang !== 'en' && en) return en as string;
  return (obj[field] ?? '') as string;
}

export function isValidOfferLang(v: string | null | undefined): v is OfferLang {
  return v === 'de' || v === 'en' || v === 'it' || v === 'fr';
}
