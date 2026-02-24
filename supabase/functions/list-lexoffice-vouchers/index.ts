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

    // Build LexOffice API URL with query params
    const params = new URLSearchParams();

    // LexOffice voucherType: kommaseparierte Liste gültiger Typen
    if (voucherType && voucherType !== 'all') {
      params.append('voucherType', voucherType);
    } else {
      // Alle gültigen Voucher-Typen (laut API-Doku)
      params.append('voucherType', 'salesinvoice,salescreditnote,purchaseinvoice,purchasecreditnote,invoice,creditnote,orderconfirmation,quotation');
    }

    // Status filter
    if (voucherStatus) {
      params.append('voucherStatus', voucherStatus);
    }

    // Pagination
    params.append('page', page.toString());
    params.append('size', size.toString());

    // Date filters
    if (createdDateFrom) {
      params.append('createdDateFrom', createdDateFrom);
    }
    if (createdDateTo) {
      params.append('createdDateTo', createdDateTo);
    }

    const lexofficeUrl = `https://api.lexoffice.io/v1/voucherlist?${params.toString()}`;
    logStep('Calling LexOffice API', { url: lexofficeUrl });

    const response = await fetch(lexofficeUrl, {
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logStep('LexOffice API error', { status: response.status, error: errorText });
      return new Response(
        JSON.stringify({
          error: `LexOffice API error: ${response.status}`,
          details: errorText,
          content: [],
          totalPages: 0,
          totalElements: 0,
          currentPage: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lexofficeData = await response.json();
    logStep('LexOffice response', {
      totalElements: lexofficeData.totalElements,
      totalPages: lexofficeData.totalPages,
      contentLength: lexofficeData.content?.length
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

    // Create a map for quick lookup
    const lexofficeIdToLocal = new Map<string, { id: string; orderNumber?: string; type: 'order' | 'inquiry' }>();

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
