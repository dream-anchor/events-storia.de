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

const STATUS_MAP: Record<string, string> = {
  new: 'inquiry',
  in_progress: 'offer_draft',
  offer_sent: 'offer_sent',
  confirmed: 'paid',
  rejected: 'cancelled',
  archived: 'cancelled',
}

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

  // Idempotency: external_id stored in v2_events.number
  if (body.external_id) {
    const { data: existing } = await supabase
      .from('v2_events')
      .select('id, created_at, status')
      .eq('service_type', 'group')
      .eq('number', String(body.external_id))
      .maybeSingle()
    if (existing) {
      return ok({ id: existing.id, status: existing.status, duplicate: true, created_at: existing.created_at }, 200)
    }
  }

  // Customer find-or-create
  const email = String(body.email).toLowerCase().trim()
  let customerId: string | null = null
  {
    const { data: existing } = await supabase
      .from('v2_customers')
      .select('id')
      .ilike('email', email)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (existing?.id) customerId = existing.id
    else {
      const { data: created, error: cErr } = await supabase
        .from('v2_customers')
        .insert({
          name: body.contact_name || email,
          company: body.company_name || null,
          email,
          phone: body.phone || null,
        })
        .select('id')
        .single()
      if (cErr) return bad(500, 'Customer create failed', cErr.message)
      customerId = created!.id
    }
  }

  const row = {
    customer_id: customerId,
    number: body.external_id ? String(body.external_id) : null,
    status: STATUS_MAP[status] ?? 'inquiry',
    service_type: 'group',
    source: 'reisegruppen',
    date: body.preferred_date ?? null,
    event_time: body.arrival_time ?? null,
    guest_count: groupSize,
    occasion: 'Reisegruppe',
    customer_notes: body.message ?? null,
    language: body.language ?? 'de',
    arrival_time: body.arrival_time ?? null,
    preferred_menu: body.preferred_menu ?? null,
    preferred_date_flexible: body.preferred_date_flexible ?? false,
    travel_plan_url: travelPlanUrl,
    travel_plan_filename: travelPlanFilename,
    archived: status === 'archived',
  }

  const { data, error } = await supabase
    .from('v2_events')
    .insert(row)
    .select('id, created_at, status')
    .single()

  if (error) return bad(500, 'Insert failed', error.message)

  const { error: markerError } = await supabase
    .from('v2_events')
    .update({ source_inquiry_id: data.id })
    .eq('id', data.id)

  if (markerError) return bad(500, 'Compatibility marker failed', markerError.message)

  return ok({ id: data.id, status: data.status, created_at: data.created_at, duplicate: false }, 201)
})