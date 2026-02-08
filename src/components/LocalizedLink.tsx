import { Link, type LinkProps } from 'react-router-dom';
import { useLocalizedPath } from '@/hooks/useLocalizedPath';
import type { RouteKey } from '@/config/routes';

interface LocalizedLinkProps extends Omit<LinkProps, 'to'> {
  /** Route key ("contact") or legacy path ("/kontakt"). Supports hash: "events#contact" */
  to: RouteKey | string;
  /** Force a specific language (bypasses current language context) */
  lang?: 'de' | 'en';
}

/**
 * Drop-in replacement for react-router-dom's <Link>.
 * Automatically resolves to the correct localized path.
 *
 * Usage:
 *   <LocalizedLink to="contact">Kontakt</LocalizedLink>
 *   <LocalizedLink to="events#contact">Anfragen</LocalizedLink>
 *   <LocalizedLink to="/some/legacy/path">Legacy</LocalizedLink>
 */
export const LocalizedLink = ({ to, lang, ...props }: LocalizedLinkProps) => {
  const { getPath } = useLocalizedPath();
  const resolved = getPath(to, lang);
  return <Link to={resolved} {...props} />;
};
