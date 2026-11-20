/** Turnstile-Site-Key (VITE_TURNSTILE_SITE_KEY); ohne Key wird kein Widget gerendert. */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY);
