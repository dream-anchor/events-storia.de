/**
 * Converts a string to a URL-friendly slug
 * Handles German umlauts and special characters
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // German umlauts
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // Remove accents from other characters
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Replace spaces and special characters with hyphens
    .replace(/[^a-z0-9]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a unique slug by appending a number if necessary
 */
export async function generateUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  
  while (await checkExists(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}
