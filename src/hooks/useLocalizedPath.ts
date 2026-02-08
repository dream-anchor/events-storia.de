import { useLanguage } from '@/contexts/LanguageContext';
import { getLocalizedPath, getAlternatePath, RouteKey, ROUTES } from '@/config/routes';

/**
 * Hook for getting localized paths based on current language.
 * Accepts RouteKey ("contact") or legacy path ("/kontakt").
 * Supports hash fragments: getPath('events') + '#contact'
 */
export function useLocalizedPath() {
  const { language } = useLanguage();

  function getPath(keyOrPath: RouteKey | string, targetLang?: 'de' | 'en'): string {
    const lang = targetLang || language;

    // If it starts with '/' it's a legacy path — return as-is
    // (allows gradual migration without breaking existing code)
    if (keyOrPath.startsWith('/')) {
      return keyOrPath;
    }

    // Split off hash fragment if present: "events#contact" → key="events", hash="#contact"
    const hashIdx = keyOrPath.indexOf('#');
    const key = (hashIdx >= 0 ? keyOrPath.slice(0, hashIdx) : keyOrPath) as RouteKey;
    const hash = hashIdx >= 0 ? keyOrPath.slice(hashIdx) : '';

    return getLocalizedPath(key, lang) + hash;
  }

  function getAlternate(keyOrPath: RouteKey | string): string {
    const targetLang = language === 'de' ? 'en' : 'de';

    if (keyOrPath.startsWith('/')) {
      return getAlternatePath(keyOrPath, language);
    }

    const hashIdx = keyOrPath.indexOf('#');
    const key = (hashIdx >= 0 ? keyOrPath.slice(0, hashIdx) : keyOrPath) as RouteKey;
    const hash = hashIdx >= 0 ? keyOrPath.slice(hashIdx) : '';

    return getLocalizedPath(key, targetLang) + hash;
  }

  return { getPath, getAlternate, language };
}
