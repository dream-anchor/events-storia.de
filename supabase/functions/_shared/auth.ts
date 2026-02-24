/**
 * Shared Auth-Helper — prüft ob der Aufrufer admin oder staff ist.
 * Gibt { user, role } zurück oder wirft einen Fehler.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type AppRole = 'admin' | 'staff';

interface AuthResult {
  userId: string;
  email: string;
  role: AppRole;
}

/**
 * Prüft Authorization-Header und verifiziert admin/staff Rolle.
 * Wirft Error bei fehlender Berechtigung.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new AuthError('Nicht autorisiert', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // User verifizieren
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();

  if (error || !user) {
    throw new AuthError('Nicht autorisiert', 401);
  }

  // Rolle prüfen
  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roleData } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'staff'])
    .maybeSingle();

  if (!roleData) {
    throw new AuthError('Keine Berechtigung', 403);
  }

  return {
    userId: user.id,
    email: user.email ?? '',
    role: roleData.role as AppRole,
  };
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
