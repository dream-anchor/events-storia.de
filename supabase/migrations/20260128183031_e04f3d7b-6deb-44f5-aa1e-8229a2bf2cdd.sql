-- Create event_inquiries table for storing event/catering inquiries
CREATE TABLE public.event_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  guest_count TEXT,
  event_type TEXT,
  preferred_date DATE,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notification_sent BOOLEAN DEFAULT false,
  source TEXT,
  status TEXT DEFAULT 'new',
  internal_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_inquiries ENABLE ROW LEVEL SECURITY;

-- Admins can view all inquiries
CREATE POLICY "Admins can view all inquiries"
ON public.event_inquiries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update inquiries
CREATE POLICY "Admins can update inquiries"
ON public.event_inquiries
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete inquiries
CREATE POLICY "Admins can delete inquiries"
ON public.event_inquiries
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can insert inquiries (for public contact forms)
CREATE POLICY "Anyone can insert inquiries"
ON public.event_inquiries
FOR INSERT
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_event_inquiries_updated_at
BEFORE UPDATE ON public.event_inquiries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();