/**
 * Zentrale Admin-Konfiguration für Mitarbeiternamen
 * 
 * Single Source of Truth für alle Admin-Anzeigenamen im System.
 * Wird verwendet für: Timeline, EditorIndicator, UserProfileDropdown, EventsList, etc.
 */

interface AdminInfo {
  fullName: string;
  firstName: string;
  initials: string;
  mobile?: string;
}

const ADMIN_REGISTRY: Record<string, AdminInfo> = {
  'monot@hey.com': { 
    fullName: 'Antoine Monot', 
    firstName: 'Antoine', 
    initials: 'AM' 
  },
  'mimmo2905@yahoo.de': { 
    fullName: 'Domenico Speranza', 
    firstName: 'Domenico', 
    initials: 'DS',
    mobile: '+49 163 6033912'
  },
  'nicola@storia.de': { 
    fullName: 'Nicola Speranza', 
    firstName: 'Nicola', 
    initials: 'NS' 
  },
  'madi@events-storia.de': { 
    fullName: 'Madina Khader', 
    firstName: 'Madina', 
    initials: 'MK',
    mobile: '+49 179 2200921'
  },
  'madina.khader@gmail.com': { 
    fullName: 'Madina Khader', 
    firstName: 'Madina', 
    initials: 'MK',
    mobile: '+49 179 2200921'
  },
  'info@storia.de': { 
    fullName: 'Storia Team', 
    firstName: 'Storia Team', 
    initials: 'ST' 
  },
};

/**
 * Get the full display name for an admin email
 * Falls back to email username if not in registry
 */
export function getAdminDisplayName(email?: string | null): string {
  if (!email) return 'System';
  const info = ADMIN_REGISTRY[email.toLowerCase()];
  if (info) return info.fullName;
  // Fallback: extract name from email
  const localPart = email.split('@')[0];
  return localPart
    .replace(/[._-]/g, ' ')
    .replace(/\d+/g, '')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim() || email;
}

/**
 * Get the initials (2 characters) for an admin email
 */
export function getAdminInitials(email?: string | null): string {
  if (!email) return 'SY';
  const info = ADMIN_REGISTRY[email.toLowerCase()];
  if (info) return info.initials;
  return email.slice(0, 2).toUpperCase();
}

/**
 * Get the first name for email signatures
 */
export function getAdminFirstName(email?: string | null): string {
  if (!email) return 'STORIA Team';
  const info = ADMIN_REGISTRY[email.toLowerCase()];
  if (info) return info.firstName;
  return email.split('@')[0];
}

/**
 * Get the mobile number for signatures (if available)
 */
export function getAdminMobile(email?: string | null): string | undefined {
  if (!email) return undefined;
  return ADMIN_REGISTRY[email.toLowerCase()]?.mobile;
}

/**
 * Check if an email belongs to a known admin
 */
export function isKnownAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase() in ADMIN_REGISTRY;
}
