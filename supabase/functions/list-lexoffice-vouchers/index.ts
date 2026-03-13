import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';



interface VoucherListRequest {
  voucherType?: 'invoice' | 'quotation' | 'creditnote' | 'all';
  voucherStatus?: 'draft' | 'open' | 'paid' | 'voided' | 'overdue';
  page?: number;
  size?: number;
  createdDateFrom?: string;
  createdDateTo?: string;
}

interface LexOfficeVoucher {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  voucherType: string;
  voucherStatus: string;
  totalAmount: number;
  currency: string;
  contactName: string;
  contactId?: string;
  // Link to local order if exists
  localOrderId?: string;
  localOrderNumber?: string;
}

interface VoucherListResponse {
  content: LexOfficeVoucher[];
  totalPages: number;
  totalElements: number;
  currentPage: number;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[LEXOFFICE-LIST] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');

  if (!lexofficeApiKey) {
    console.warn('LEXOFFICE_API_KEY not configured');
    return new Response(
      JSON.stringify({
        error: 'LexOffice API key not configured',
        content: [],
        totalPages: 0,
        totalElements: 0,
        currentPage: 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Auth-Check: Nur admin/staff dürfen LexOffice-Daten sehen
    await requireAuth(req);

    // Parse request body
    const body: VoucherListRequest = await req.json().catch(() => ({}));
    const {
      voucherType = 'all',
      voucherStatus,
      page = 0,
      size = 50,
      createdDateFrom,
      createdDateTo
    } = body;

    logStep('Fetching voucher list', { voucherType, voucherStatus, page, size });

    // Frontend-Werte auf LexOffice voucherType-Werte mappen
    const typeMap: Record<string, string> = {
      invoice: 'salesinvoice',
      creditnote: 'salescreditnote',
      quotation: 'quotation',
    };

    // LexOffice API unterstützt KEINE komma-separierten voucherType-Parameter.
    // Bei 'all' müssen wir separate Calls pro Typ machen und mergen.
    const typesToFetch: string[] = [];
    if (voucherType && voucherType !== 'all' && typeMap[voucherType]) {
      typesToFetch.push(typeMap[voucherType]);
    } else {
      // 'all' = Rechnungen + Gutschriften (keine Angebote)
      typesToFetch.push('salesinvoice', 'salescreditnote');
    }

    // Status filter (Pflichtparameter)
    const statusParam = voucherStatus
      ? voucherStatus
      : 'draft,open,paid,paidoff,voided,accepted,rejected';

    // Helper: ALLE Seiten eines Voucher-Typs abrufen
    const fetchAllPagesForType = async (lexType: string): Promise<{ content: any[]; totalElements: number; error?: string }> => {
      const allItems: any[] = [];
      let currentPage = 0;
      let totalElements = 0;
      const pageSize = 250; // LexOffice max

      while (true) {
        const params = new URLSearchParams();
        params.append('voucherType', lexType);
        params.append('voucherStatus', statusParam);
        params.append('page', currentPage.toString());
        params.append('size', pageSize.toString());
        if (createdDateFrom) params.append('createdDateFrom', createdDateFrom);
        if (createdDateTo) params.append('createdDateTo', createdDateTo);

        const url = `https://api.lexoffice.io/v1/voucherlist?${params.toString()}`;
        logStep('Calling LexOffice API', { lexType, page: currentPage });

        const resp = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${lexofficeApiKey}`,
            'Accept': 'application/json'
          }
        });

        if (!resp.ok) {
          const errorText = await resp.text();
          logStep('LexOffice API error', { status: resp.status, error: errorText, lexType });
          return { content: allItems, totalElements, error: `${resp.status}: ${errorText}` };
        }

        const data = await resp.json();
        const items = data.content || [];
        allItems.push(...items);
        totalElements = data.totalElements || 0;

        logStep(`LexOffice page result`, { lexType, page: currentPage, itemsOnPage: items.length, totalElements });

        // Nächste Seite nötig?
        if (items.length < pageSize || allItems.length >= totalElements) break;
        currentPage++;
      }

      return { content: allItems, totalElements };
    };

    // Typen SEQUENZIELL abfragen (LexOffice Rate Limit: 2 req/s)
    const allContent: any[] = [];
    let totalElements = 0;
    let firstError: string | undefined;

    for (const lexType of typesToFetch) {
      const result = await fetchAllPagesForType(lexType);
      if (result.error && !firstError) firstError = result.error;
      allContent.push(...result.content);
      totalElements += result.totalElements;
    }

    // Nach Datum sortieren (neueste zuerst)
    allContent.sort((a: any, b: any) => {
      const dateA = a.voucherDate || '';
      const dateB = b.voucherDate || '';
      return dateB.localeCompare(dateA);
    });

    if (firstError && allContent.length === 0) {
      return new Response(
        JSON.stringify({
          error: `LexOffice API error: ${firstError}`,
          content: [],
          totalPages: 0,
          totalElements: 0,
          currentPage: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lexofficeData = {
      content: allContent,
      totalElements,
      totalPages: 1,
      number: 0,
    };

    // Debug: Alle Voucher-IDs aus der API loggen
    const apiVoucherIds = allContent.map((item: any) => item.id);
    logStep('LexOffice merged response', {
      totalElements,
      typesQueried: typesToFetch.length,
      contentLength: allContent.length,
      sampleIds: apiVoucherIds.slice(0, 5),
      containsTarget: apiVoucherIds.includes('6d192839-c077-4514-8645-c25d5f2248b9'),
    });

    // Get all lexoffice_invoice_ids from local database to match with vouchers
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch from catering_orders
    const { data: orders } = await supabaseAdmin
      .from('catering_orders')
      .select('id, order_number, lexoffice_invoice_id')
      .not('lexoffice_invoice_id', 'is', null);

    // Fetch from event_inquiries (if they have lexoffice fields)
    const { data: inquiries } = await supabaseAdmin
      .from('event_inquiries')
      .select('id, lexoffice_invoice_id')
      .not('lexoffice_invoice_id', 'is', null);

    // Fetch from event_bookings
    const { data: bookings } = await supabaseAdmin
      .from('event_bookings')
      .select('id, lexoffice_invoice_id')
      .not('lexoffice_invoice_id', 'is', null);

    // Create a map for quick lookup
    const lexofficeIdToLocal = new Map<string, { id: string; orderNumber?: string; type: 'order' | 'inquiry' | 'booking' }>();

    orders?.forEach(order => {
      if (order.lexoffice_invoice_id) {
        lexofficeIdToLocal.set(order.lexoffice_invoice_id, {
          id: order.id,
          orderNumber: order.order_number,
          type: 'order'
        });
      }
    });

    inquiries?.forEach(inquiry => {
      if (inquiry.lexoffice_invoice_id) {
        lexofficeIdToLocal.set(inquiry.lexoffice_invoice_id, {
          id: inquiry.id,
          type: 'inquiry'
        });
      }
    });

    bookings?.forEach(booking => {
      if (booking.lexoffice_invoice_id) {
        lexofficeIdToLocal.set(booking.lexoffice_invoice_id, {
          id: booking.id,
          type: 'booking'
        });
      }
    });

    // Transform LexOffice vouchers to our format
    const vouchers: LexOfficeVoucher[] = (lexofficeData.content || []).map((item: any) => {
      const localMatch = lexofficeIdToLocal.get(item.id);

      return {
        id: item.id,
        voucherNumber: item.voucherNumber || '-',
        voucherDate: item.voucherDate,
        voucherType: item.voucherType,
        voucherStatus: item.voucherStatus,
        totalAmount: item.totalAmount || 0,
        currency: item.currency || 'EUR',
        contactName: item.contactName || 'Unbekannt',
        contactId: item.contactId,
        localOrderId: localMatch?.id,
        localOrderNumber: localMatch?.orderNumber,
      };
    });

    const result: VoucherListResponse = {
      content: vouchers,
      totalPages: lexofficeData.totalPages || 0,
      totalElements: lexofficeData.totalElements || 0,
      currentPage: lexofficeData.number || page,
    };

    logStep('Returning voucher list', {
      count: vouchers.length,
      matchedLocal: vouchers.filter(v => v.localOrderId).length
    });

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep('Error in list-lexoffice-vouchers', { error: errorMessage });
    return new Response(
      JSON.stringify({
        error: errorMessage,
        content: [],
        totalPages: 0,
        totalElements: 0,
        currentPage: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
