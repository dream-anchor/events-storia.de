-- =====================================================
-- Phase 1: Event Booking & Offer System Database Schema
-- =====================================================

-- 1. Create event_bookings table for paid package bookings
CREATE TABLE public.event_bookings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_number TEXT NOT NULL UNIQUE,
    customer_email TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    company_name TEXT,
    phone TEXT,
    package_id UUID REFERENCES public.packages(id),
    guest_count INTEGER NOT NULL,
    event_date DATE NOT NULL,
    event_time TEXT,
    location_id UUID REFERENCES public.locations(id),
    menu_selection JSONB,
    menu_confirmed BOOLEAN DEFAULT false,
    total_amount NUMERIC(10,2),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'partial')),
    stripe_payment_intent_id TEXT,
    stripe_payment_link_id TEXT,
    status TEXT DEFAULT 'menu_pending' CHECK (status IN ('menu_pending', 'confirmed', 'ready', 'completed', 'cancelled')),
    internal_notes TEXT,
    source_inquiry_id UUID REFERENCES public.event_inquiries(id),
    source_option_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create inquiry_offer_options table for multi-package offers
CREATE TABLE public.inquiry_offer_options (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    inquiry_id UUID NOT NULL REFERENCES public.event_inquiries(id) ON DELETE CASCADE,
    offer_version INTEGER NOT NULL DEFAULT 1,
    package_id UUID REFERENCES public.packages(id),
    option_label TEXT NOT NULL DEFAULT 'A',
    guest_count INTEGER NOT NULL,
    menu_selection JSONB,
    total_amount NUMERIC(10,2) NOT NULL,
    stripe_payment_link_id TEXT,
    stripe_payment_link_url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create inquiry_offer_history table for versioning
CREATE TABLE public.inquiry_offer_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    inquiry_id UUID NOT NULL REFERENCES public.event_inquiries(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_by TEXT,
    email_content TEXT,
    pdf_url TEXT,
    options_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Extend event_inquiries table with offer tracking columns
ALTER TABLE public.event_inquiries 
ADD COLUMN IF NOT EXISTS current_offer_version INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS selected_option_id UUID,
ADD COLUMN IF NOT EXISTS converted_to_booking_id UUID;

-- 5. Add foreign key constraint for source_option_id after inquiry_offer_options exists
ALTER TABLE public.event_bookings 
ADD CONSTRAINT event_bookings_source_option_id_fkey 
FOREIGN KEY (source_option_id) REFERENCES public.inquiry_offer_options(id);

-- 6. Add foreign key for converted_to_booking_id
ALTER TABLE public.event_inquiries 
ADD CONSTRAINT event_inquiries_converted_to_booking_id_fkey 
FOREIGN KEY (converted_to_booking_id) REFERENCES public.event_bookings(id);

-- 7. Create indexes for performance
CREATE INDEX idx_event_bookings_status ON public.event_bookings(status);
CREATE INDEX idx_event_bookings_payment_status ON public.event_bookings(payment_status);
CREATE INDEX idx_event_bookings_event_date ON public.event_bookings(event_date);
CREATE INDEX idx_inquiry_offer_options_inquiry_id ON public.inquiry_offer_options(inquiry_id);
CREATE INDEX idx_inquiry_offer_options_version ON public.inquiry_offer_options(offer_version);
CREATE INDEX idx_inquiry_offer_history_inquiry_id ON public.inquiry_offer_history(inquiry_id);

-- 8. Enable RLS on all new tables
ALTER TABLE public.event_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_offer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_offer_history ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for event_bookings (admin only)
CREATE POLICY "Admins can manage event_bookings"
ON public.event_bookings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 10. RLS Policies for inquiry_offer_options (admin only)
CREATE POLICY "Admins can manage inquiry_offer_options"
ON public.inquiry_offer_options
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 11. RLS Policies for inquiry_offer_history (admin only)
CREATE POLICY "Admins can manage inquiry_offer_history"
ON public.inquiry_offer_history
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 12. Create trigger for updated_at on event_bookings
CREATE TRIGGER update_event_bookings_updated_at
BEFORE UPDATE ON public.event_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Create trigger for updated_at on inquiry_offer_options
CREATE TRIGGER update_inquiry_offer_options_updated_at
BEFORE UPDATE ON public.inquiry_offer_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Create function to generate booking numbers
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_year INTEGER;
    next_num INTEGER;
BEGIN
    current_year := EXTRACT(YEAR FROM now());
    next_num := get_next_order_number('EVT', current_year);
    RETURN 'EVT-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;