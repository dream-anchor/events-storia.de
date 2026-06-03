// Shared LexOffice → Maestro sync logic.
// Fetches an invoice from LexOffice and reconciles it with public.v2_payments.
// Detects conflicts when local Maestro state diverges from LexOffice.

// deno-lint-ignore-file no-explicit-any

const LEX_BASE = 'https://api.lexoffice.io/v1';

type SupabaseAdmin = any;

export interface SyncOutcome {
  applied: boolean;
  conflict: boolean;
  v2_payment_id: string | null;
  remote_status: string | null;
  remote_total_cents: number | null;
  remote_version: number | null;
  diff?: Record<string, { local: unknown; remote: unknown }>;
  error?: string;
  notFound?: boolean;
}

async function fetchLexOfficeInvoice(invoiceId: string, apiKey: string) {
  const res = await fetch(`${LEX_BASE}/invoices/${invoiceId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  if (res.status === 404) return { notFound: true as const };
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LexOffice GET /invoices/${invoiceId} failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return { notFound: false as const, data };
}

function mapLexStatus(voucherStatus: string | undefined): string {
  // LexOffice statuses: draft, open, paid, paidoff, voided, transferred, sepadebit, overdue
  switch (voucherStatus) {
    case 'paid':
    case 'paidoff':
      return 'paid';
    case 'voided':
      return 'cancelled';
    case 'open':
    case 'overdue':
      return 'open';
    case 'draft':
      return 'draft';
    default:
      return voucherStatus ?? 'unknown';
  }
}

function diffPayment(local: any, remoteStatus: string, remoteTotalCents: number) {
  const diff: Record<string, { local: unknown; remote: unknown }> = {};
  if (local.status && local.status !== remoteStatus && !(local.status === 'paid' && remoteStatus === 'paid')) {
    diff.status = { local: local.status, remote: remoteStatus };
  }
  if (typeof local.amount_cents === 'number' && local.amount_cents !== remoteTotalCents) {
    diff.amount_cents = { local: local.amount_cents, remote: remoteTotalCents };
  }
  return diff;
}

export async function syncLexOfficeInvoice(
  supabaseAdmin: SupabaseAdmin,
  lexofficeApiKey: string,
  invoiceId: string,
  eventType: string,
): Promise<SyncOutcome> {
  const outcome: SyncOutcome = {
    applied: false,
    conflict: false,
    v2_payment_id: null,
    remote_status: null,
    remote_total_cents: null,
    remote_version: null,
  };

  let fetched;
  try {
    fetched = await fetchLexOfficeInvoice(invoiceId, lexofficeApiKey);
  } catch (err) {
    outcome.error = (err as Error).message;
    await logEvent(supabaseAdmin, invoiceId, eventType, null, outcome);
    return outcome;
  }

  if (fetched.notFound) {
    outcome.notFound = true;
    outcome.error = 'Invoice not found in LexOffice';
    // Mark Maestro payment as deleted-upstream if it exists
    const { data: rows } = await supabaseAdmin
      .from('v2_payments')
      .select('id, status')
      .eq('lexoffice_invoice_id', invoiceId);
    const row = rows?.[0];
    if (row) {
      outcome.v2_payment_id = row.id;
      await supabaseAdmin
        .from('v2_payments')
        .update({
          lexoffice_remote_status: 'deleted',
          lexoffice_sync_conflict: true,
          lexoffice_conflict_details: { reason: 'voucher_deleted_in_lexoffice' },
          lexoffice_last_synced_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      outcome.conflict = true;
    }
    await logEvent(supabaseAdmin, invoiceId, eventType, fetched, outcome);
    return outcome;
  }

  const remote = fetched.data;
  const remoteStatus = mapLexStatus(remote.voucherStatus);
  const totalGross = Number(remote?.totalPrice?.totalGrossAmount ?? 0);
  const remoteTotalCents = Math.round(totalGross * 100);
  const remoteVersion = typeof remote.version === 'number' ? remote.version : null;

  outcome.remote_status = remoteStatus;
  outcome.remote_total_cents = remoteTotalCents;
  outcome.remote_version = remoteVersion;

  const { data: rows, error: selErr } = await supabaseAdmin
    .from('v2_payments')
    .select('id, status, amount_cents, updated_at, lexoffice_last_synced_at, paid_at')
    .eq('lexoffice_invoice_id', invoiceId);
  if (selErr) {
    outcome.error = `DB select failed: ${selErr.message}`;
    await logEvent(supabaseAdmin, invoiceId, eventType, fetched, outcome);
    return outcome;
  }
  const local = rows?.[0];
  if (!local) {
    outcome.error = 'No Maestro payment linked to this LexOffice invoice';
    await logEvent(supabaseAdmin, invoiceId, eventType, fetched, outcome);
    return outcome;
  }
  outcome.v2_payment_id = local.id;

  const diff = diffPayment(local, remoteStatus, remoteTotalCents);
  const locallyModified =
    !local.lexoffice_last_synced_at ||
    (local.updated_at && new Date(local.updated_at) > new Date(local.lexoffice_last_synced_at));

  // Conflict: local was modified after last sync AND values differ
  const isConflict = Object.keys(diff).length > 0 && locallyModified;

  const update: Record<string, unknown> = {
    lexoffice_last_synced_at: new Date().toISOString(),
    lexoffice_remote_status: remoteStatus,
    lexoffice_remote_total_cents: remoteTotalCents,
    lexoffice_remote_version: remoteVersion,
    lexoffice_sync_conflict: isConflict,
    lexoffice_conflict_details: isConflict ? diff : null,
  };

  if (!isConflict) {
    // Safe to apply remote state to Maestro
    if (remoteStatus === 'paid' && local.status !== 'paid') {
      update.status = 'paid';
      if (!local.paid_at) update.paid_at = new Date().toISOString();
      update.paid_via = 'lexoffice';
    } else if (remoteStatus === 'cancelled' && local.status !== 'cancelled') {
      update.status = 'cancelled';
    } else if (remoteStatus === 'open' && local.status === 'draft') {
      update.status = 'open';
    }
    if (remoteTotalCents > 0 && local.amount_cents !== remoteTotalCents) {
      update.amount_cents = remoteTotalCents;
    }
    outcome.applied = true;
  } else {
    outcome.conflict = true;
    outcome.diff = diff;
  }

  const { error: updErr } = await supabaseAdmin
    .from('v2_payments')
    .update(update)
    .eq('id', local.id);
  if (updErr) {
    outcome.error = `DB update failed: ${updErr.message}`;
    outcome.applied = false;
  }

  await logEvent(supabaseAdmin, invoiceId, eventType, fetched, outcome);
  return outcome;
}

async function logEvent(
  supabaseAdmin: SupabaseAdmin,
  invoiceId: string | null,
  eventType: string,
  payload: unknown,
  outcome: SyncOutcome,
) {
  try {
    await supabaseAdmin.from('lexoffice_sync_log').insert({
      lexoffice_invoice_id: invoiceId,
      event_type: eventType,
      payload: payload as any,
      applied: outcome.applied,
      conflict: outcome.conflict,
      error: outcome.error ?? null,
      v2_payment_id: outcome.v2_payment_id,
    });
  } catch (err) {
    console.error('[lexoffice-sync] failed to write sync log', err);
  }
}