import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Auth-Check: Nur Admins dürfen Nutzer verwalten
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // User-Client für Auth-Check
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Nicht autorisiert' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prüfe Admin-Rolle
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: adminRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'Nur Administratoren können Nutzer verwalten' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case 'list': {
        // Liste aller Nutzer mit Rollen
        const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
        if (listError) throw listError;

        const { data: roles } = await adminClient
          .from('user_roles')
          .select('user_id, role');

        const roleMap = new Map<string, string>();
        roles?.forEach(r => roleMap.set(r.user_id, r.role));

        const result = users.map(u => ({
          id: u.id,
          email: u.email,
          name: u.user_metadata?.full_name || u.email?.split('@')[0] || 'Unbekannt',
          role: roleMap.get(u.id) || 'none',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          is_active: !u.banned_until,
        })).filter(u => roleMap.has(u.id)); // Nur Nutzer mit Rolle anzeigen

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'invite': {
        const ALLOWED_ROLES = ['admin', 'staff'];
        const { email, name, role = 'staff' } = params;
        if (!email) throw new Error('E-Mail ist erforderlich');
        if (!ALLOWED_ROLES.includes(role)) throw new Error('Ungültige Rolle');

        // Nutzer erstellen
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: name || email.split('@')[0] },
        });
        if (createError) throw createError;

        // Rolle zuweisen
        await adminClient.from('user_roles').insert({
          user_id: newUser.user.id,
          role: role,
        });

        // Passwort-Reset-Link senden
        await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email,
        });

        return new Response(JSON.stringify({
          success: true,
          user: { id: newUser.user.id, email, name, role },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'updateRole': {
        const ALLOWED_ROLES = ['admin', 'staff'];
        const { userId, role } = params;
        if (!userId || !role) throw new Error('userId und role sind erforderlich');
        if (!ALLOWED_ROLES.includes(role)) throw new Error('Ungültige Rolle');

        // Eigene Rolle kann nicht geändert werden
        if (userId === user.id) {
          throw new Error('Sie können Ihre eigene Rolle nicht ändern');
        }

        // Bestehende Rolle aktualisieren oder einfügen
        const { data: existing } = await adminClient
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existing) {
          await adminClient
            .from('user_roles')
            .update({ role })
            .eq('user_id', userId);
        } else {
          await adminClient
            .from('user_roles')
            .insert({ user_id: userId, role });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'deactivate': {
        const { userId } = params;
        if (!userId) throw new Error('userId ist erforderlich');

        if (userId === user.id) {
          throw new Error('Sie können sich nicht selbst deaktivieren');
        }

        // Nutzer bannen (Supabase ban)
        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: '876000h', // ~100 Jahre
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'activate': {
        const { userId } = params;
        if (!userId) throw new Error('userId ist erforderlich');

        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: 'none',
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unbekannte Aktion: ${action}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
