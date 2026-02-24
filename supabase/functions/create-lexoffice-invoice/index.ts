import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';



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
  // Document type - 'quotation' for unpaid, 'invoice' for paid orders
  documentType?: 'quotation' | 'invoice';
  isPaid?: boolean;
  // Additional order details for document
  desiredDate?: string;
  desiredTime?: string;
  deliveryAddress?: string;
  notes?: string;
  paymentMethod?: 'invoice' | 'stripe';
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[LEXOFFICE] ${step}${detailsStr}`);
};

// Round to 2 decimal places for currency values (LexOffice requires max 4 decimals)
const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

// Format date for German display (DD.MM.YYYY)
const formatDateDE = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}.${month}.${year}`;
};

// Generate order number using database sequence
// Format: EVT-BUCHUNG-DD-MM-YYYY-XXX (Events) or CAT-BESTELLUNG-DD-MM-YYYY-XXX (Catering)
// Note: Shop orders are always Stripe-paid, so we use CAT-BESTELLUNG (not CAT-ANGEBOT)
const generateOrderNumber = async (
  supabase: any, 
  _isInvoice: boolean, // kept for API compatibility
  isEventBooking: boolean,
  date: Date
): Promise<string> => {
  // Event-Pakete: EVT-BUCHUNG
  // Catering: CAT-BESTELLUNG (Shop orders are always Stripe-paid)
  const prefix = isEventBooking ? 'EVT-BUCHUNG' : 'CAT-BESTELLUNG';
  
  const year = date.getFullYear();
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  try {
    // Get next number from sequence using raw query (RPC typing issue)
    const { data, error } = await supabase.rpc('get_next_order_number', {
      p_prefix: prefix,
      p_year: year
    } as any);
    
    if (error) {
      logStep('Error getting next order number, using fallback', { error: error.message });
      // Fallback: use timestamp-based number
      const fallbackNum = Math.floor(Date.now() / 1000) % 1000 + 100;
      return `${prefix}-${day}-${month}-${year}-${fallbackNum}`;
    }
    
    const sequenceNum = data || 100;
    return `${prefix}-${day}-${month}-${year}-${sequenceNum}`;
  } catch (err) {
    logStep('Exception getting next order number', { error: String(err) });
    const fallbackNum = Math.floor(Date.now() / 1000) % 1000 + 100;
    return `${prefix}-${day}-${month}-${year}-${fallbackNum}`;
  }
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
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
    
    // Initialize Supabase client for updating order and generating order number
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // ============================================================
    // SECURITY: Verify order exists and email matches
    // ============================================================
    if (!body.orderId) {
      logStep('Security: Missing orderId in request');
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { data: existingOrder, error: orderLookupError } = await supabase
      .from('catering_orders')
      .select('id, order_number, customer_email, total_amount')
      .eq('id', body.orderId)
      .maybeSingle();
    
    if (orderLookupError || !existingOrder) {
      logStep('Security: Order not found in database', { orderId: body.orderId });
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify email matches to prevent unauthorized document creation
    if (existingOrder.customer_email?.toLowerCase() !== body.customerEmail?.toLowerCase()) {
      logStep('Security: Email mismatch', { 
        orderEmail: existingOrder.customer_email, 
        requestEmail: body.customerEmail 
      });
      return new Response(
        JSON.stringify({ error: 'Email mismatch' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    logStep('Security: Order validated', { orderId: body.orderId, orderNumber: existingOrder.order_number });
    // ============================================================
    
    // Determine document type: default to 'quotation' for unpaid orders
    const documentType = body.documentType || 'quotation';
    const isInvoice = documentType === 'invoice';
    
    // Generate new-format order number if the old format is used
    let orderNumber = body.orderNumber;
    const isOldFormat = orderNumber.startsWith('STO-');
    
    // Detect if this is an event booking based on order number prefix
    const isEventBooking = orderNumber.startsWith('EVT-BUCHUNG') || 
                           (body as any).isEventBooking === true;
    
    if (isOldFormat) {
      // Generate new order number with correct format
      orderNumber = await generateOrderNumber(supabase, isInvoice, isEventBooking, new Date());
      logStep('Generated new order number', { oldNumber: body.orderNumber, newNumber: orderNumber });
      
      // Update the order in database with new order number
      if (body.orderId) {
        const { error: updateNumError } = await supabase
          .from('catering_orders')
          .update({ order_number: orderNumber })
          .eq('id', body.orderId);
        
        if (updateNumError) {
          logStep('Failed to update order number in database', { error: updateNumError });
        }
      }
    }
    
    logStep('Creating Lexoffice document', { 
      orderNumber, 
      documentType,
      isPaid: body.isPaid,
      desiredDate: body.desiredDate,
      desiredTime: body.desiredTime,
      paymentMethod: body.paymentMethod
    });

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
          netAmount: roundCurrency(item.price / 1.07), // Convert gross to net (7% VAT for food)
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
          netAmount: roundCurrency(body.minimumOrderSurcharge / 1.07),
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
          netAmount: roundCurrency(body.deliveryCost / 1.19), // Convert gross to net (19% VAT for delivery)
          taxRatePercentage: 19
        }
      });
    }

    // Step 3: Build introduction and remark with all order details
    const buildIntroduction = (): string => {
      const lines: string[] = [];
      
      if (isInvoice) {
        lines.push('Vielen Dank für Ihre Bestellung und Zahlung bei STORIA Events!');
      } else {
        lines.push('Vielen Dank für Ihre Bestellung bei STORIA Events!');
      }
      
      lines.push('');
      
      // Delivery/Pickup date and time
      if (body.desiredDate || body.desiredTime) {
        const dateStr = body.desiredDate ? formatDateDE(body.desiredDate) : '';
        const timeStr = body.desiredTime || '';
        if (dateStr && timeStr) {
          lines.push(`📅 Termin: ${dateStr} um ${timeStr} Uhr`);
        } else if (dateStr) {
          lines.push(`📅 Datum: ${dateStr}`);
        } else if (timeStr) {
          lines.push(`🕐 Uhrzeit: ${timeStr} Uhr`);
        }
      }
      
      // Delivery address or pickup
      if (body.isPickup) {
        lines.push('📍 Abholung im Restaurant');
        lines.push('   STORIA, Karlstr. 47a, 80333 München');
      } else if (body.deliveryAddress) {
        lines.push('📍 Lieferadresse:');
        // Handle multi-line address
        const addressLines = body.deliveryAddress.split('\n').filter(l => l.trim());
        addressLines.forEach(line => {
          lines.push(`   ${line.trim()}`);
        });
      }
      
      return lines.join('\n');
    };
    
    const buildRemark = (): string => {
      const lines: string[] = [];
      
      // Order number (use the new generated number)
      lines.push(`Bestellnummer: ${orderNumber}`);
      lines.push('');
      
      // Payment method
      if (body.paymentMethod) {
        const paymentLabel = body.paymentMethod === 'stripe' 
          ? 'Per Kreditkarte/Online bezahlt' 
          : 'Auf Rechnung (Zahlungsziel: 14 Tage)';
        lines.push(`💳 Zahlungsart: ${paymentLabel}`);
        if (isInvoice && body.isPaid) {
          lines.push('✅ Status: Bereits bezahlt');
        }
        lines.push('');
      }
      
      // Customer notes (includes setup service info)
      if (body.notes && body.notes.trim()) {
        lines.push('📝 Anmerkungen des Kunden:');
        const noteLines = body.notes.split('\n').filter(l => l.trim());
        noteLines.forEach(line => {
          lines.push(`   ${line.trim()}`);
        });
        lines.push('');
      }
      
      // Billing address (if different from delivery)
      if (body.billingAddress && body.billingAddress.street) {
        const hasBillingInfo = body.billingAddress.name || body.billingAddress.street;
        if (hasBillingInfo) {
          lines.push('🧾 Rechnungsadresse:');
          if (body.billingAddress.name) {
            lines.push(`   ${body.billingAddress.name}`);
          }
          if (body.billingAddress.street) {
            lines.push(`   ${body.billingAddress.street}`);
          }
          if (body.billingAddress.zip || body.billingAddress.city) {
            lines.push(`   ${body.billingAddress.zip} ${body.billingAddress.city}`.trim());
          }
          lines.push('');
        }
      }
      
      // Document validity note
      if (!isInvoice) {
        lines.push('Dieses Angebot ist 14 Tage gültig.');
      }
      
      // Services included
      lines.push('');
      lines.push('ℹ️ Hinweis: Reinigung des Geschirrs ist im Preis inbegriffen.');
      
      return lines.join('\n');
    };

    // Step 4: Create document (quotation or invoice)
    // LexOffice requires full ISO 8601 datetime format
    const today = new Date().toISOString();
    
    // Calculate expiration date for quotations (14 days from now)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 14);
    
    // Configure document-specific settings
    const introduction = buildIntroduction();
    const remark = buildRemark();
    
    const paymentConditions = isInvoice 
      ? {
          paymentTermLabel: 'Bereits bezahlt - Vielen Dank!',
          paymentTermDuration: 0
        }
      : {
          paymentTermLabel: 'Zahlbar innerhalb von 14 Tagen nach Rechnungseingang',
          paymentTermDuration: 14
        };

    const documentPayload: Record<string, unknown> = {
      voucherDate: today,
      // Quotations require expirationDate - LexOffice needs full ISO 8601 format
      ...(documentType === 'quotation' && { 
        expirationDate: expirationDate.toISOString()
      }),
      lineItems,
      totalPrice: { currency: 'EUR' },
      taxConditions: { taxType: 'net' },
      title: 'Catering-Rechnung', // Shop orders are always paid via Stripe
      introduction,
      remark,
      paymentConditions
    };
    
    // Invoices require shippingConditions - add for paid orders
    if (isInvoice) {
      documentPayload.shippingConditions = {
        shippingType: body.isPickup ? 'pickup' : 'delivery',
        shippingDate: body.desiredDate ? new Date(body.desiredDate).toISOString().split('T')[0] : today.split('T')[0]
      };
    }

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

    // Step 5: Update order with Lexoffice IDs and document type
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
        orderNumber, // Return the (potentially new) order number
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
