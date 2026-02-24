import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



interface LineItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number; // Gross price
  taxRate: number; // 7 or 19
}

interface ManualInvoiceRequest {
  contactName: string;
  companyName?: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    zip: string;
    city: string;
    country?: string;
  };
  items: LineItem[];
  eventInquiryId?: string;
  documentType: 'invoice' | 'quotation';
  introduction?: string;
  remark?: string;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[MANUAL-INVOICE] ${step}${detailsStr}`);
};

// Round to 2 decimal places for currency values
const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');

  if (!lexofficeApiKey) {
    return new Response(
      JSON.stringify({ error: 'LexOffice API key not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify admin authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const body: ManualInvoiceRequest = await req.json();

    if (!body.contactName || !body.email || !body.items?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: contactName, email, items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    logStep('Creating manual invoice', {
      contactName: body.contactName,
      documentType: body.documentType,
      itemCount: body.items.length
    });

    // Step 1: Create or find contact in LexOffice
    const nameParts = body.contactName.split(' ');
    const firstName = nameParts[0] || body.contactName;
    const lastName = nameParts.slice(1).join(' ') || '';

    const contactPayload: Record<string, unknown> = {
      version: 0,
      roles: { customer: {} },
      emailAddresses: { business: [body.email] },
    };

    if (body.companyName) {
      contactPayload.company = {
        name: body.companyName,
        contactPersons: [{
          firstName,
          lastName: lastName || firstName,
          emailAddress: body.email,
          phoneNumber: body.phone
        }]
      };
    } else {
      contactPayload.person = {
        firstName,
        lastName: lastName || firstName
      };
    }

    if (body.address?.street) {
      contactPayload.addresses = {
        billing: [{
          street: body.address.street,
          zip: body.address.zip || '',
          city: body.address.city || '',
          countryCode: body.address.country === 'Österreich' ? 'AT' :
                       body.address.country === 'Schweiz' ? 'CH' : 'DE'
        }]
      };
    }

    if (body.phone) {
      contactPayload.phoneNumbers = { business: [body.phone] };
    }

    logStep('Creating LexOffice contact...');
    const contactResponse = await fetch('https://api.lexoffice.io/v1/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(contactPayload)
    });

    let contactId: string | null = null;
    if (contactResponse.ok) {
      const contactData = await contactResponse.json();
      contactId = contactData.id;
      logStep('Contact created', { contactId });
    } else {
      const errorText = await contactResponse.text();
      logStep('Contact creation failed (continuing without)', {
        status: contactResponse.status,
        error: errorText.slice(0, 200)
      });
    }

    // Step 2: Build line items
    const lineItems = body.items.map(item => ({
      type: 'custom',
      name: item.name,
      description: item.description || undefined,
      quantity: item.quantity,
      unitName: 'Stück',
      unitPrice: {
        currency: 'EUR',
        netAmount: roundCurrency(item.unitPrice / (1 + item.taxRate / 100)),
        taxRatePercentage: item.taxRate
      }
    }));

    // Step 3: Create document
    const today = new Date().toISOString();
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 14);

    const isInvoice = body.documentType === 'invoice';

    const documentPayload: Record<string, unknown> = {
      voucherDate: today,
      lineItems,
      totalPrice: { currency: 'EUR' },
      taxConditions: { taxType: 'net' },
      title: isInvoice ? 'Rechnung' : 'Angebot',
      introduction: body.introduction || `Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage. Anbei erhalten Sie ${isInvoice ? 'unsere Rechnung' : 'unser Angebot'}.`,
      remark: body.remark || (isInvoice
        ? 'Zahlbar innerhalb von 14 Tagen nach Rechnungseingang.\n\nVielen Dank für Ihr Vertrauen!'
        : 'Dieses Angebot ist 14 Tage gültig.\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.'),
      paymentConditions: isInvoice
        ? { paymentTermLabel: 'Zahlbar innerhalb von 14 Tagen', paymentTermDuration: 14 }
        : { paymentTermLabel: 'Bei Auftragserteilung', paymentTermDuration: 14 }
    };

    if (body.documentType === 'quotation') {
      documentPayload.expirationDate = expirationDate.toISOString();
    }

    if (isInvoice) {
      documentPayload.shippingConditions = {
        shippingType: 'service',
        shippingDate: today.split('T')[0]
      };
    }

    if (contactId) {
      documentPayload.address = { contactId };
    } else {
      documentPayload.address = {
        name: body.companyName || body.contactName,
        street: body.address?.street || '',
        zip: body.address?.zip || '',
        city: body.address?.city || '',
        countryCode: 'DE'
      };
    }

    // Create the document
    const endpoint = isInvoice ? 'invoices' : 'quotations';
    logStep(`Creating LexOffice ${body.documentType}...`);

    const documentResponse = await fetch(`https://api.lexoffice.io/v1/${endpoint}?finalize=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(documentPayload)
    });

    if (!documentResponse.ok) {
      const errorText = await documentResponse.text();
      logStep('Document creation failed', {
        status: documentResponse.status,
        error: errorText
      });
      return new Response(
        JSON.stringify({
          error: `LexOffice API error: ${documentResponse.status}`,
          details: errorText
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const documentData = await documentResponse.json();
    const documentId = documentData.id;
    logStep('Document created', { documentId, documentType: body.documentType });

    // Step 4: Update event inquiry if provided
    if (body.eventInquiryId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { error: updateError } = await supabaseAdmin
        .from('event_inquiries')
        .update({
          lexoffice_invoice_id: documentId,
          lexoffice_document_type: body.documentType,
          lexoffice_contact_id: contactId
        })
        .eq('id', body.eventInquiryId);

      if (updateError) {
        logStep('Failed to update event inquiry', { error: updateError.message });
      } else {
        logStep('Event inquiry updated with LexOffice IDs');

        // Log activity
        // Fire and forget activity log
        void supabaseAdmin.from('activity_logs').insert({
          entity_type: 'event_inquiry',
          entity_id: body.eventInquiryId,
          action: `${body.documentType}_created`,
          metadata: {
            lexoffice_invoice_id: documentId,
            document_type: body.documentType
          },
          actor_email: user.email
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId,
        documentType: body.documentType,
        contactId,
        message: `LexOffice ${body.documentType === 'invoice' ? 'Rechnung' : 'Angebot'} erstellt`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep('Error in create-manual-invoice', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
