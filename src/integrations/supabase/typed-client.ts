/**
 * Compatibility-Layer client.
 *
 * Background: After the v2 migration, many "tables" (event_inquiries,
 * event_payments, inquiry_offer_options, etc.) are now Postgres VIEWS
 * with INSTEAD OF triggers. The auto-generated types.ts treats views
 * as read-only, so .insert()/.update() against them fails to type-check.
 *
 * The DB accepts those writes correctly (via triggers). To unblock the
 * frontend without rewriting ~30 call sites, this file re-exports the
 * supabase client with a relaxed type that allows writes on any "from".
 *
 * USAGE: import this in files that write to compatibility-layer views.
 *   import { supabase } from "@/integrations/supabase/typed-client";
 */
import { supabase as typedSupabase } from "./client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = typedSupabase as any;
