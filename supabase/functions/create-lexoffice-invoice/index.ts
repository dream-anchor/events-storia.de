import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  id: string;
  name: string;
  name_en?: string;
  quantity: number;
  price: number;
}

interface BillingAddress {
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
}

interface InvoiceRequest {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName?: string;
  billingAddress: BillingAddress;
  items: OrderItem[];
  subtotal: number;
  deliveryCost: number;
  minimumOrderSurcharge: number;
  distanceKm?: number;
  grandTotal: number;
  isPickup: boolean;
  // NEW: Document type - 'quotation' for unpaid, 'invoice' for paid orders
  documentType?: 'quotation' | 'invoice';
  isPaid?: boolean;
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[LEXOFFICE] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
  
  // Graceful degradation if API key not configured
  if (!lexofficeApiKey) {
    console.warn('LEXOFFICE_API_KEY not configured - skipping document creation');
    return new Response(
      JSON.stringify({ 
        skipped: true, 
        reason: 'API key not configured',
        message: 'Lexoffice document creation skipped - API key not set'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: InvoiceRequest = await req.json();
    
    // Determine document type: default to 'quotation' for unpaid orders
    const documentType = body.documentType || 'quotation';
    const isInvoice = documentType === 'invoice';
    
    logStep('Creating Lexoffice document', { 
      orderNumber: body.orderNumber, 
      documentType,
      isPaid: body.isPaid 
    });

    // Initialize Supabase client for updating order
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Create or find contact in Lexoffice
    const contactPayload = {
      version: 0,
      roles: { customer: {} },
      ...(body.companyName ? {
        company: {
          name: body.companyName,
          contactPersons: [{
            firstName: body.customerName.split(' ')[0] || body.customerName,
            lastName: body.customerName.split(' ').slice(1).join(' ') || '',
            emailAddress: body.customerEmail,
            phoneNumber: body.customerPhone
          }]
        }
      } : {
        person: {
          firstName: body.customerName.split(' ')[0] || body.customerName,
          lastName: body.customerName.split(' ').slice(1).join(' ') || body.customerName
        }
      }),
      addresses: {
        billing: [{
          street: body.billingAddress.street || '',
          zip: body.billingAddress.zip || '',
          city: body.billingAddress.city || '',
          countryCode: 'DE'
        }]
      },
      emailAddresses: {
        business: [body.customerEmail]
      },
      phoneNumbers: {
        business: [body.customerPhone]
      }
    };

    logStep('Creating Lexoffice contact...');
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
        error: errorText 
      });
    }

    // Step 2: Build line items
    const lineItems = [];

    // Add order items
    for (const item of body.items) {
      lineItems.push({
        type: 'custom',
        name: item.name,
        quantity: item.quantity,
        unitName: 'Stück',
        unitPrice: {
          currency: 'EUR',
          netAmount: item.price / 1.07, // Convert gross to net (7% VAT for food)
          taxRatePercentage: 7
        }
      });
    }

    // Add minimum order surcharge if applicable
    if (body.minimumOrderSurcharge > 0) {
      lineItems.push({
        type: 'custom',
        name: 'Mindestbestellwert-Aufschlag',
        quantity: 1,
        unitName: 'Stück',
        unitPrice: {
          currency: 'EUR',
          netAmount: body.minimumOrderSurcharge / 1.07,
          taxRatePercentage: 7
        }
      });
    }

    // Add delivery cost if applicable
    if (body.deliveryCost > 0) {
      const deliveryName = body.distanceKm 
        ? `Lieferung (${body.distanceKm.toFixed(1)} km)`
        : 'Lieferung';
      
      lineItems.push({
        type: 'custom',
        name: deliveryName,
        quantity: 1,
        unitName: 'Stück',
        unitPrice: {
          currency: 'EUR',
          netAmount: body.deliveryCost / 1.19, // Convert gross to net (19% VAT for delivery)
          taxRatePercentage: 19
        }
      });
    }

    // Step 3: Create document (quotation or invoice)
    const today = new Date().toISOString().split('T')[0];
    
    // Configure document-specific settings
    const documentConfig = isInvoice 
      ? {
          title: 'Catering-Rechnung',
          introduction: 'Vielen Dank für Ihre Bestellung und Zahlung bei STORIA Events!',
          remark: `Bestellnummer: ${body.orderNumber}\n\nDiese Rechnung wurde bereits bezahlt.`,
          paymentConditions: {
            paymentTermLabel: 'Bereits bezahlt - Vielen Dank!',
            paymentTermDuration: 0
          }
        }
      : {
          title: 'Catering-Angebot',
          introduction: 'Vielen Dank für Ihre Anfrage bei STORIA Events! Nachfolgend finden Sie unser Angebot.',
          remark: `Bestellnummer: ${body.orderNumber}\n\nDieses Angebot ist 14 Tage gültig.`,
          paymentConditions: {
            paymentTermLabel: 'Zahlbar innerhalb von 14 Tagen nach Rechnungseingang',
            paymentTermDuration: 14
          }
        };

    const documentPayload: Record<string, unknown> = {
      voucherDate: today,
      lineItems,
      totalPrice: { currency: 'EUR' },
      taxConditions: { taxType: 'net' },
      title: documentConfig.title,
      introduction: documentConfig.introduction,
      remark: documentConfig.remark,
      paymentConditions: documentConfig.paymentConditions
    };

    // Use contact ID if available, otherwise use address directly
    if (contactId) {
      documentPayload.address = { contactId };
    } else {
      documentPayload.address = {
        name: body.companyName || body.customerName,
        street: body.billingAddress.street || '',
        zip: body.billingAddress.zip || '',
        city: body.billingAddress.city || '',
        countryCode: 'DE'
      };
    }

    // Choose endpoint based on document type
    const endpoint = isInvoice ? 'invoices' : 'quotations';
    
    // Use finalize=true to enable automatic email sending from LexOffice
    logStep(`Creating Lexoffice ${documentType}...`, { endpoint });
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
          success: false, 
          error: `Lexoffice API error: ${documentResponse.status}`,
          details: errorText
        }),
        { 
          status: 200, // Return 200 so order isn't marked as failed
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const documentData = await documentResponse.json();
    const documentId = documentData.id;
    logStep('Document created', { documentId, documentType });

    // Step 4: Update order with Lexoffice IDs and document type
    if (body.orderId) {
      const updateData: Record<string, unknown> = {
        lexoffice_invoice_id: documentId,
        lexoffice_contact_id: contactId,
        lexoffice_document_type: documentType
      };
      
      // If this is an invoice (paid), also update payment status
      if (isInvoice && body.isPaid) {
        updateData.payment_status = 'paid';
      }

      const { error: updateError } = await supabase
        .from('catering_orders')
        .update(updateData)
        .eq('id', body.orderId);

      if (updateError) {
        logStep('Failed to update order with Lexoffice IDs', { error: updateError });
      } else {
        logStep('Order updated with Lexoffice IDs');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        documentId,
        documentType,
        contactId,
        message: `Lexoffice ${documentType} created and email sent to customer`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep('Error in create-lexoffice-invoice', { error: errorMessage });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: 'Failed to create Lexoffice document'
      }),
      { 
        status: 200, // Return 200 so order isn't marked as failed
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
