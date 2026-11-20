/** Bild in zwei Größen nach Namenskonvention (<name>.webp = 1200 px, <name>-600.webp = 600 px). */
export function giftImageProps(url: string | null) {
  if (!url) return { src: undefined, srcSet: undefined };
  const small = url.replace(/\.webp$/, "-600.webp");
  return { src: url, srcSet: small !== url ? `${small} 600w, ${url} 1200w` : undefined };
}

