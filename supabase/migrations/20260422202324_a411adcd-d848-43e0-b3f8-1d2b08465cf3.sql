-- =====================================================================
-- PHASE 1: v2 Datenmodell — Neue Tabellen parallel zu Legacy
-- =====================================================================

-- ENUMS
CREATE TYPE public.v2_event_status AS ENUM (
  'inquiry','offer_draft','offer_sent','offer_chosen',
  'paid','completed','offer_declined','cancelled',
  'payment_failed','no_response'
);
CREATE TYPE public.v2_event_location AS ENUM ('in_house','external');
CREATE TYPE public.v2_event_service AS ENUM ('restaurant','catering','hybrid');
CREATE TYPE public.v2_event_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.v2_event_source AS ENUM ('website','manual','email_inbound','phone','catering_form');
CREATE TYPE public.v2_offer_mode AS ENUM ('alacarte','partial_menu','full_menu','package','email');
CREATE TYPE public.v2_payment_type AS ENUM ('deposit','prepayment','final','full','refund');
CREATE TYPE public.v2_payment_status AS ENUM ('draft','sent','paid','overdue','cancelled','refunded','failed');
CREATE TYPE public.v2_task_status AS ENUM ('open','in_progress','done','cancelled');
CREATE TYPE public.v2_email_direction AS ENUM ('inbound','outbound');

-- =====================================================================
-- TABLE 1: v2_customers
-- =====================================================================
CREATE TABLE public.v2_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text,
  email text NOT NULL,
  phone text,
  address_street text,
  address_zip text,
  address_city text,
  lexoffice_contact_id text,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  merged_into_id uuid REFERENCES public.v2_customers(id) ON DELETE SET NULL,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_v2_customers_email_lower ON public.v2_customers (lower(email));
CREATE INDEX idx_v2_customers_merged_into ON public.v2_customers (merged_into_id) WHERE merged_into_id IS NOT NULL;
CREATE INDEX idx_v2_customers_auth_user ON public.v2_customers (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- =====================================================================
-- TABLE 2: v2_events
-- =====================================================================
CREATE TABLE public.v2_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.v2_customers(id),
  number text UNIQUE,
  status public.v2_event_status NOT NULL DEFAULT 'inquiry',
  location public.v2_event_location,
  service_type public.v2_event_service,
  date date,
  date_end date,
  event_end_date date,
  time_from time,
  time_to time,
  event_time text,
  guest_count integer,
  occasion text,
  location_details text,
  amount_total numeric(10,2),
  is_test boolean DEFAULT false,
  source public.v2_event_source NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  status_changed_at timestamptz,
  assigned_to text,
  assigned_at timestamptz,
  assigned_by text,
  priority public.v2_event_priority DEFAULT 'normal',
  internal_notes text,
  customer_notes text,
  package_id uuid REFERENCES public.packages(id),
  location_id uuid REFERENCES public.locations(id),
  offer_slug text UNIQUE,
  offer_sent_at timestamptz,
  offer_sent_by text,
  offer_phase text,
  current_offer_version integer DEFAULT 1,
  payment_type text CHECK (payment_type IS NULL OR payment_type IN ('full','deposit')),
  deposit_percent integer CHECK (deposit_percent IS NULL OR (deposit_percent >= 0 AND deposit_percent <= 100)),
  deposit_due_days integer CHECK (deposit_due_days IS NULL OR deposit_due_days >= 1),
  offer_validity_days integer CHECK (offer_validity_days IS NULL OR offer_validity_days >= 1),
  booking_number text UNIQUE,
  archived boolean DEFAULT false,
  archived_at timestamptz,
  archived_by text,
  last_edited_at timestamptz,
  last_edited_by text,
  reminder_count integer DEFAULT 0,
  reminder_sent_at timestamptz,
  notification_sent boolean DEFAULT false,
  menu_confirmed boolean DEFAULT false,
  menu_confirmed_at timestamptz,
  invoice_lexoffice_id text,
  invoice_lexoffice_number text,
  lexoffice_quotation_id text,
  lexoffice_document_type text,
  confirmation_email_sent_at timestamptz,
  selected_items jsonb DEFAULT '[]'::jsonb,
  selected_packages jsonb DEFAULT '[]'::jsonb,
  quote_items jsonb DEFAULT '[]'::jsonb,
  menu_selection jsonb DEFAULT '{}'::jsonb,
  items jsonb,
  email_draft text,
  quote_notes text,
  -- Location-Block
  location_name text,
  location_type text CHECK (location_type IS NULL OR location_type IN ('storia','company','custom')),
  location_street text,
  location_postal_code text,
  location_city text,
  location_country text DEFAULT 'Deutschland',
  venue text,
  -- Company-Block
  company_name text,
  company_street text,
  company_postal_code text,
  company_city text,
  company_country text DEFAULT 'Deutschland',
  -- Billing-Block
  billing_address_different boolean DEFAULT false,
  billing_company_name text,
  billing_name text,
  billing_street text,
  billing_postal_code text,
  billing_city text,
  billing_country text DEFAULT 'Deutschland',
  -- Catering-Delivery-Block
  delivery_address text,
  delivery_street text,
  delivery_zip text,
  delivery_city text,
  delivery_floor text,
  has_elevator boolean DEFAULT false,
  is_pickup boolean DEFAULT false,
  calculated_distance_km numeric,
  delivery_cost_cents integer,
  minimum_order_surcharge_cents integer,
  -- Legacy-Links
  source_inquiry_id uuid UNIQUE,
  source_booking_id uuid UNIQUE,
  source_catering_id uuid UNIQUE
);
CREATE INDEX idx_v2_events_customer ON public.v2_events (customer_id);
CREATE INDEX idx_v2_events_status ON public.v2_events (status);
CREATE INDEX idx_v2_events_date ON public.v2_events (date);
CREATE INDEX idx_v2_events_is_test ON public.v2_events (is_test) WHERE is_test = true;
CREATE INDEX idx_v2_events_offer_slug ON public.v2_events (offer_slug) WHERE offer_slug IS NOT NULL;
CREATE INDEX idx_v2_events_archived_at ON public.v2_events (archived_at) WHERE archived_at IS NOT NULL;

-- =====================================================================
-- TABLE 3: v2_offer_options
-- =====================================================================
CREATE TABLE public.v2_offer_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.v2_events(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'A',
  package_id uuid REFERENCES public.packages(id),
  package_name_snapshot text,
  offer_mode public.v2_offer_mode,
  menu_selection jsonb,
  guest_count integer NOT NULL,
  amount_total numeric(10,2) NOT NULL,
  version integer DEFAULT 1,
  is_active boolean DEFAULT true,
  is_chosen boolean DEFAULT false,
  chosen_at timestamptz,
  chosen_by_email text,
  chosen_notes text,
  is_outdated boolean DEFAULT false,
  outdated_reason text,
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_option_id uuid UNIQUE
);
CREATE INDEX idx_v2_offer_options_event ON public.v2_offer_options (event_id);
CREATE INDEX idx_v2_offer_options_active ON public.v2_offer_options (is_active) WHERE is_active = true;
CREATE INDEX idx_v2_offer_options_chosen ON public.v2_offer_options (is_chosen) WHERE is_chosen = true;

-- =====================================================================
-- TABLE 4: v2_payments
-- =====================================================================
CREATE TABLE public.v2_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.v2_events(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  payment_type public.v2_payment_type NOT NULL,
  status public.v2_payment_status NOT NULL DEFAULT 'draft',
  due_date date,
  due_days_before_event integer,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text UNIQUE,
  stripe_payment_link_url text,
  paid_at timestamptz,
  paid_via text,
  lexoffice_invoice_id text,
  lexoffice_invoice_number text,
  email_sent_at timestamptz,
  email_resend_id text,
  reminder_sent_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_payment_id uuid UNIQUE,
  source_booking_payment_id uuid UNIQUE,
  source_offer_option_id uuid UNIQUE
);
CREATE INDEX idx_v2_payments_event ON public.v2_payments (event_id);
CREATE INDEX idx_v2_payments_status ON public.v2_payments (status);
CREATE INDEX idx_v2_payments_paid_at ON public.v2_payments (paid_at);

-- =====================================================================
-- TABLE 5: v2_event_changelog
-- =====================================================================
CREATE TABLE public.v2_event_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.v2_events(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value text,
  new_value text,
  changed_by text NOT NULL DEFAULT 'system',
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  source text CHECK (source IS NULL OR source IN ('app','trigger'))
);
CREATE INDEX idx_v2_event_changelog_event ON public.v2_event_changelog (event_id);
CREATE INDEX idx_v2_event_changelog_changed_at ON public.v2_event_changelog (changed_at DESC);

-- =====================================================================
-- TABLE 6: v2_event_comments
-- =====================================================================
CREATE TABLE public.v2_event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.v2_events(id) ON DELETE CASCADE,
  author_email text NOT NULL,
  content text NOT NULL,
  parent_id uuid REFERENCES public.v2_event_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source_comment_id uuid UNIQUE
);
CREATE INDEX idx_v2_event_comments_event ON public.v2_event_comments (event_id);
CREATE INDEX idx_v2_event_comments_parent ON public.v2_event_comments (parent_id);

-- =====================================================================
-- TABLE 7: v2_event_tasks
-- =====================================================================
CREATE TABLE public.v2_event_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.v2_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status public.v2_task_status NOT NULL DEFAULT 'open',
  priority public.v2_event_priority NOT NULL DEFAULT 'normal',
  due_date timestamptz,
  assigned_to text,
  completed_at timestamptz,
  completed_by text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reminder_sent boolean DEFAULT false,
  source_task_id uuid UNIQUE
);
CREATE INDEX idx_v2_event_tasks_event ON public.v2_event_tasks (event_id);
CREATE INDEX idx_v2_event_tasks_assigned_to ON public.v2_event_tasks (assigned_to);
CREATE INDEX idx_v2_event_tasks_status ON public.v2_event_tasks (status);
CREATE INDEX idx_v2_event_tasks_due_date ON public.v2_event_tasks (due_date);

-- =====================================================================
-- TABLE 8: v2_event_offer_history
-- =====================================================================
CREATE TABLE public.v2_event_offer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.v2_events(id) ON DELETE CASCADE,
  version integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by text,
  email_content text,
  pdf_url text,
  options_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_history_id uuid UNIQUE
);
CREATE INDEX idx_v2_event_offer_history_event ON public.v2_event_offer_history (event_id);

-- =====================================================================
-- TABLE 9: v2_event_emails
-- =====================================================================
CREATE TABLE public.v2_event_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.v2_events(id) ON DELETE CASCADE,
  direction public.v2_email_direction NOT NULL,
  from_email text NOT NULL,
  to_email text NOT NULL,
  cc_email text,
  subject text,
  body_text text,
  body_html text,
  attachments jsonb DEFAULT '[]'::jsonb,
  resend_message_id text,
  resend_status text DEFAULT 'queued',
  in_reply_to text,
  received_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  source_message_id uuid UNIQUE
);
CREATE INDEX idx_v2_event_emails_event ON public.v2_event_emails (event_id);
CREATE INDEX idx_v2_event_emails_resend_id ON public.v2_event_emails (resend_message_id);

-- =====================================================================
-- VIEW: v2_payments_enriched
-- =====================================================================
CREATE VIEW public.v2_payments_enriched AS
SELECT p.*,
       COALESCE(p.due_date,
         CASE WHEN p.due_days_before_event IS NOT NULL AND e.date IS NOT NULL
              THEN (e.date - (p.due_days_before_event || ' days')::interval)::date
         END) AS effective_due_date,
       CASE
         WHEN p.status = 'paid' THEN 'paid'
         WHEN p.status = 'sent' AND COALESCE(p.due_date,
           (e.date - (p.due_days_before_event || ' days')::interval)::date) < CURRENT_DATE
         THEN 'overdue'
         ELSE p.status::text
       END AS computed_status,
       e.date AS event_date,
       e.guest_count,
       e.service_type,
       e.location,
       c.name AS customer_name,
       c.email AS customer_email
FROM public.v2_payments p
JOIN public.v2_events e ON e.id = p.event_id
JOIN public.v2_customers c ON c.id = e.customer_id;

-- =====================================================================
-- TRIGGERS (updated_at)
-- =====================================================================
CREATE TRIGGER update_v2_customers_updated_at BEFORE UPDATE ON public.v2_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_v2_events_updated_at BEFORE UPDATE ON public.v2_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_v2_offer_options_updated_at BEFORE UPDATE ON public.v2_offer_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_v2_payments_updated_at BEFORE UPDATE ON public.v2_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_v2_event_comments_updated_at BEFORE UPDATE ON public.v2_event_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_v2_event_tasks_updated_at BEFORE UPDATE ON public.v2_event_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- RLS — ENABLE + Policies
-- =====================================================================
ALTER TABLE public.v2_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_offer_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_event_changelog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_event_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_event_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_event_offer_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_event_emails ENABLE ROW LEVEL SECURITY;

-- v2_customers
CREATE POLICY "Admins can manage v2_customers" ON public.v2_customers TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage v2_customers" ON public.v2_customers TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role)) WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- v2_events
CREATE POLICY "Admins can manage v2_events" ON public.v2_events TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage v2_events" ON public.v2_events TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role)) WITH CHECK (has_role(auth.uid(), 'staff'::app_role));
CREATE POLICY "Anyone can insert v2_events" ON public.v2_events FOR INSERT WITH CHECK (true);

-- v2_offer_options
CREATE POLICY "Admins can manage v2_offer_options" ON public.v2_offer_options TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage v2_offer_options" ON public.v2_offer_options TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role)) WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- v2_payments
CREATE POLICY "Admins can manage v2_payments" ON public.v2_payments TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage v2_payments" ON public.v2_payments TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role)) WITH CHECK (has_role(auth.uid(), 'staff'::app_role));
CREATE POLICY "anon can view payment status by event" ON public.v2_payments FOR SELECT TO anon
  USING (status::text NOT IN ('cancelled','refunded','draft'));

-- v2_event_changelog
CREATE POLICY "Admins can manage v2_event_changelog" ON public.v2_event_changelog TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage v2_event_changelog" ON public.v2_event_changelog TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role)) WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- v2_event_comments
CREATE POLICY "Admins can manage v2_event_comments" ON public.v2_event_comments TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage v2_event_comments" ON public.v2_event_comments TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role)) WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- v2_event_tasks
CREATE POLICY "Admins can manage v2_event_tasks" ON public.v2_event_tasks TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage v2_event_tasks" ON public.v2_event_tasks TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role)) WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- v2_event_offer_history
CREATE POLICY "Admins can manage v2_event_offer_history" ON public.v2_event_offer_history TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage v2_event_offer_history" ON public.v2_event_offer_history TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role)) WITH CHECK (has_role(auth.uid(), 'staff'::app_role));

-- v2_event_emails
CREATE POLICY "Admins can manage v2_event_emails" ON public.v2_event_emails TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Staff can manage v2_event_emails" ON public.v2_event_emails TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role)) WITH CHECK (has_role(auth.uid(), 'staff'::app_role));
CREATE POLICY "Authenticated users can read v2_event_emails" ON public.v2_event_emails FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Service role can insert v2_event_emails" ON public.v2_event_emails FOR INSERT TO service_role
  WITH CHECK (true);
CREATE POLICY "Service role can update v2_event_emails" ON public.v2_event_emails FOR UPDATE TO service_role
  USING (true);