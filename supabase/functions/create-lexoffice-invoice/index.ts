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
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
  
  // Graceful degradation if API key not configured
  if (!lexofficeApiKey) {
    console.warn('LEXOFFICE_API_KEY not configured - skipping invoice creation');
    return new Response(
      JSON.stringify({ 
        skipped: true, 
        reason: 'API key not configured',
        message: 'Lexoffice invoice creation skipped - API key not set'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: InvoiceRequest = await req.json();
    console.log('Creating Lexoffice invoice for order:', body.orderNumber);

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

    console.log('Creating Lexoffice contact...');
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
      console.log('Contact created:', contactId);
    } else {
      const errorText = await contactResponse.text();
      console.warn('Contact creation failed:', contactResponse.status, errorText);
      // Continue without contact - invoice will use address directly
    }

    // Step 2: Build line items for invoice
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
          netAmount: item.price,
          taxRatePercentage: 19
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
          netAmount: body.minimumOrderSurcharge,
          taxRatePercentage: 19
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
          netAmount: body.deliveryCost,
          taxRatePercentage: 19
        }
      });
    }

    // Step 3: Create invoice
    const today = new Date().toISOString().split('T')[0];
    
    const invoicePayload: Record<string, unknown> = {
      voucherDate: today,
      lineItems,
      totalPrice: { currency: 'EUR' },
      taxConditions: { taxType: 'net' },
      title: 'Catering-Rechnung',
      introduction: 'Vielen Dank für Ihre Bestellung bei STORIA Events!',
      remark: `Bestellnummer: ${body.orderNumber}`,
      paymentConditions: {
        paymentTermLabel: 'Zahlbar innerhalb von 14 Tagen nach Rechnungseingang',
        paymentTermDuration: 14
      }
    };

    // Use contact ID if available, otherwise use address directly
    if (contactId) {
      invoicePayload.address = { contactId };
    } else {
      invoicePayload.address = {
        name: body.companyName || body.customerName,
        street: body.billingAddress.street || '',
        zip: body.billingAddress.zip || '',
        city: body.billingAddress.city || '',
        countryCode: 'DE'
      };
    }

    console.log('Creating Lexoffice invoice...');
    const invoiceResponse = await fetch('https://api.lexoffice.io/v1/invoices', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(invoicePayload)
    });

    if (!invoiceResponse.ok) {
      const errorText = await invoiceResponse.text();
      console.error('Invoice creation failed:', invoiceResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Lexoffice API error: ${invoiceResponse.status}`,
          details: errorText
        }),
        { 
          status: 200, // Return 200 so order isn't marked as failed
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const invoiceData = await invoiceResponse.json();
    const invoiceId = invoiceData.id;
    console.log('Invoice created:', invoiceId);

    // Step 4: Update order with Lexoffice IDs
    if (body.orderId) {
      const { error: updateError } = await supabase
        .from('catering_orders')
        .update({
          lexoffice_invoice_id: invoiceId,
          lexoffice_contact_id: contactId
        })
        .eq('id', body.orderId);

      if (updateError) {
        console.warn('Failed to update order with Lexoffice IDs:', updateError);
      } else {
        console.log('Order updated with Lexoffice IDs');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invoiceId,
        contactId,
        message: 'Lexoffice invoice created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in create-lexoffice-invoice:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        message: 'Failed to create Lexoffice invoice'
      }),
      { 
        status: 200, // Return 200 so order isn't marked as failed
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
