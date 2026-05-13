/**
 * Direct fetch zu create-payment-session Edge Function.
 *
 * Wir umgehen `supabase.functions.invoke()`, weil der Lovable Preview
 * Fetch-Proxy diese Aufrufe abfängt und die Auth-Header zerlegt — was zur
 * generischen "Fehler beim Erstellen der Zahlungssitzung"-Meldung führt.
 *
 * Direkter fetch funktioniert in Preview UND auf der publizierten Domain.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export interface PaymentSessionRequest {
  inquiryId: string;
  optionId?: string;
  paymentType: 'full' | 'deposit';
  optionQuantities?: Array<{ optionId: string; quantity: number }>;
}

export interface PaymentSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}

export async function createPaymentSession(
  body: PaymentSessionRequest,
): Promise<PaymentSessionResponse> {
  const url = `${SUPABASE_URL}/functions/v1/create-payment-session`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `Netzwerkfehler: ${err.message}`
        : 'Netzwerkfehler beim Verbindungsaufbau',
    );
  }

  let payload: { checkoutUrl?: string; sessionId?: string; error?: string } = {};
  try {
    payload = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok || !payload.checkoutUrl) {
    const raw = payload.error || `HTTP ${res.status}`;
    // Freundlichere Meldung für die häufigsten Backend-Fehler
    if (raw.includes('optionId ist erforderlich')) {
      throw new Error('Bitte zuerst eine Menü-Option auswählen.');
    }
    if (raw.includes('Anfrage nicht gefunden')) {
      throw new Error('Dieses Angebot ist nicht mehr verfügbar.');
    }
    if (raw.toLowerCase().includes('zahlungsart')) {
      throw new Error(raw);
    }
    throw new Error(`Zahlung konnte nicht gestartet werden (${raw})`);
  }

  return { checkoutUrl: payload.checkoutUrl, sessionId: payload.sessionId ?? '' };
}