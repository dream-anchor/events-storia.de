import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SHARED_SECRET = Deno.env.get('MAESTRO_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ALLOWED_STATUS = ['new', 'in_progress', 'offer_sent', 'confirmed', 'rejected', 'archived']

function bad(status: number, error: string, details?: unknown) {
  return new Response(JSON.stringify({ error, details }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function ok(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return bad(405, 'Method not allowed')

  // Auth via Shared Secret
  const provided = req.headers.get('x-webhook-secret') ?? ''
  if (!SHARED_SECRET || provided !== SHARED_SECRET) {
    return bad(401, 'Invalid or missing x-webhook-secret')
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return bad(400, 'Invalid JSON body')
  }

  // Validate required fields
  const required = ['contact_name', 'email', 'group_size']
  const missing = required.filter((f) => body[f] === undefined || body[f] === null || body[f] === '')
  if (missing.length) return bad(400, 'Missing required fields', { missing })

  const groupSize = Number(body.group_size)
  if (!Number.isFinite(groupSize) || groupSize < 1) {
    return bad(400, 'group_size must be a positive integer')
  }

  if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return bad(400, 'Invalid email')
  }

  const status = body.status ?? 'new'
  if (!ALLOWED_STATUS.includes(status)) {
    return bad(400, `Invalid status. Allowed: ${ALLOWED_STATUS.join(', ')}`)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  // Optional: PDF upload via base64
  let travelPlanUrl: string | null = body.travel_plan_url ?? null
  let travelPlanFilename: string | null = body.travel_plan_filename ?? null

  if (body.travel_plan_base64 && body.travel_plan_filename) {
    try {
      const binaryString = atob(body.travel_plan_base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
      if (bytes.byteLength > 10 * 1024 * 1024) {
        return bad(400, 'travel_plan_base64 exceeds 10 MB limit')
      }
      const safeName = String(body.travel_plan_filename).replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName}`
      const { error: upErr } = await supabase.storage
        .from('group-inquiry-uploads')
        .upload(path, bytes, {
          contentType: body.travel_plan_mime ?? 'application/pdf',
          upsert: false,
        })
      if (upErr) return bad(500, 'Upload failed', upErr.message)
      travelPlanUrl = path
      travelPlanFilename = body.travel_plan_filename
    } catch (e) {
      return bad(400, 'Invalid travel_plan_base64', String(e))
    }
  }

  const row = {
    external_id: body.external_id ?? null,
    contact_name: body.contact_name,
    company_name: body.company_name ?? null,
    email: body.email,
    phone: body.phone ?? null,
    group_size: groupSize,
    preferred_date: body.preferred_date ?? null,
    preferred_date_flexible: body.preferred_date_flexible ?? false,
    arrival_time: body.arrival_time ?? null,
    preferred_menu: body.preferred_menu ?? null,
    message: body.message ?? null,
    language: body.language ?? 'de',
    source: body.source ?? 'ristorantestoria.de/reisegruppen',
    status,
    travel_plan_url: travelPlanUrl,
    travel_plan_filename: travelPlanFilename,
    utm_source: body.utm_source ?? null,
    utm_medium: body.utm_medium ?? null,
    utm_campaign: body.utm_campaign ?? null,
    utm_term: body.utm_term ?? null,
    utm_content: body.utm_content ?? null,
  }

  // Idempotency: if external_id already exists, return existing
  if (row.external_id) {
    const { data: existing } = await supabase
      .from('group_inquiries')
      .select('id, created_at, status')
      .eq('external_id', row.external_id)
      .maybeSingle()
    if (existing) {
      return ok({ id: existing.id, status: existing.status, duplicate: true, created_at: existing.created_at }, 200)
    }
  }

  const { data, error } = await supabase
    .from('group_inquiries')
    .insert(row)
    .select('id, created_at, status')
    .single()

  if (error) return bad(500, 'Insert failed', error.message)

  return ok({ id: data.id, status: data.status, created_at: data.created_at, duplicate: false }, 201)
})