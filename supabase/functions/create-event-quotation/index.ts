import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CourseSelection {
  courseType: string;
  courseLabel: string;
  itemName: string;
  itemDescription: string | null;
}

interface DrinkSelection {
  drinkGroup: string;
  drinkLabel: string;
  selectedChoice: string | null;
  quantityLabel: string | null;
}

interface MenuSelection {
  courses: CourseSelection[];
  drinks: DrinkSelection[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { eventId, event, items, notes, menuSelection } = await req.json();
    
    const lexofficeApiKey = Deno.env.get('LEXOFFICE_API_KEY');
    if (!lexofficeApiKey) {
      throw new Error('LEXOFFICE_API_KEY not configured');
    }

    // Build menu description for introduction
    let menuDescription = '';
    if (menuSelection) {
      const typedMenu = menuSelection as MenuSelection;
      
      if (typedMenu.courses && typedMenu.courses.length > 0) {
        menuDescription += '\n\nIhr Menü:\n';
        typedMenu.courses.forEach((course, index) => {
          const label = course.courseLabel || course.courseType;
          menuDescription += `${index + 1}. ${label}: ${course.itemName}`;
          if (course.itemDescription) {
            menuDescription += ` – ${course.itemDescription}`;
          }
          menuDescription += '\n';
        });
      }
      
      if (typedMenu.drinks && typedMenu.drinks.length > 0) {
        menuDescription += '\nGetränke-Pauschale (pro Person):\n';
        typedMenu.drinks.forEach(drink => {
          let drinkText = `• ${drink.drinkLabel || drink.drinkGroup}`;
          if (drink.selectedChoice) {
            drinkText += `: ${drink.selectedChoice}`;
          }
          if (drink.quantityLabel) {
            drinkText += ` (${drink.quantityLabel})`;
          }
          menuDescription += drinkText + '\n';
        });
      }
    }

    // Build full introduction text
    const introductionParts = [
      `Event-Angebot für ${event.preferred_date || 'nach Vereinbarung'}`,
      `Gäste: ${event.guest_count || '-'}`,
      `Art: ${event.event_type || '-'}`,
    ];
    
    const introduction = introductionParts.join('\n') + menuDescription;

    // Build LexOffice quotation payload
    const quotationPayload = {
      voucherDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      address: {
        name: event.company_name || event.contact_name,
        supplement: event.company_name ? event.contact_name : undefined,
        street: '',
        zip: '',
        city: '',
        countryCode: 'DE',
      },
      lineItems: items.map((item: any) => ({
        type: 'custom',
        name: item.name,
        description: item.description || '',
        quantity: item.quantity,
        unitName: item.unitName || 'Stück',
        unitPrice: {
          currency: 'EUR',
          netAmount: Math.round(item.unitPrice.netAmount * 100) / 100,
          taxRatePercentage: item.unitPrice.taxRatePercentage || 7,
        },
      })),
      totalPrice: {
        currency: 'EUR',
      },
      taxConditions: {
        taxType: 'net',
      },
      introduction: introduction,
      remark: notes || 'Dieses Angebot ist 14 Tage gültig. Für alle Pakete ist eine Vorauszahlung von 100% erforderlich.',
    };

    console.log('Creating LexOffice quotation with menu:', JSON.stringify(quotationPayload, null, 2));

    // Create quotation in LexOffice
    const response = await fetch('https://api.lexoffice.io/v1/quotations?finalize=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lexofficeApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(quotationPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LexOffice error:', errorText);
      throw new Error(`LexOffice API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('LexOffice quotation created:', result);

    return new Response(
      JSON.stringify({ success: true, quotationId: result.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', message);
    // Return 200 with success: false so the client shows the real error instead of generic "non-2xx"
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
