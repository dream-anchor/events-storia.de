/**
 * Test-Safety utilities
 * Redirects email recipients to a safe address when is_test = true.
 */

const SAFE_EMAIL = "antoine@monot.com";

export function getSafeRecipientEmail(customerEmail: string, isTest: boolean): string {
  return isTest ? SAFE_EMAIL : customerEmail;
}

export function getSafeSubject(subject: string, isTest: boolean): string {
  return isTest ? `[TEST] ${subject}` : subject;
}
