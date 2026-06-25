export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      _legacy_catering_orders: {
        Row: {
          billing_city: string | null
          billing_country: string | null
          billing_name: string | null
          billing_street: string | null
          billing_zip: string | null
          calculated_distance_km: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          company_name: string | null
          created_at: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_cost: number | null
          delivery_floor: string | null
          delivery_street: string | null
          delivery_zip: string | null
          desired_date: string | null
          desired_time: string | null
          has_elevator: boolean | null
          id: string
          internal_notes: string | null
          is_pickup: boolean | null
          is_test: boolean | null
          items: Json
          last_customer_message_at: string | null
          last_our_reply_at: string | null
          lexoffice_contact_id: string | null
          lexoffice_credit_note_id: string | null
          lexoffice_document_type: string | null
          lexoffice_invoice_id: string | null
          minimum_order_surcharge: number | null
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: string | null
          reference_number: string | null
          reminder_sent_at: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string | null
          total_amount: number | null
          user_id: string | null
        }
        Insert: {
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          calculated_distance_km?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_cost?: number | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          desired_date?: string | null
          desired_time?: string | null
          has_elevator?: boolean | null
          id?: string
          internal_notes?: string | null
          is_pickup?: boolean | null
          is_test?: boolean | null
          items: Json
          last_customer_message_at?: string | null
          last_our_reply_at?: string | null
          lexoffice_contact_id?: string | null
          lexoffice_credit_note_id?: string | null
          lexoffice_document_type?: string | null
          lexoffice_invoice_id?: string | null
          minimum_order_surcharge?: number | null
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: string | null
          reference_number?: string | null
          reminder_sent_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          user_id?: string | null
        }
        Update: {
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          calculated_distance_km?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          company_name?: string | null
          created_at?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_cost?: number | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          desired_date?: string | null
          desired_time?: string | null
          has_elevator?: boolean | null
          id?: string
          internal_notes?: string | null
          is_pickup?: boolean | null
          is_test?: boolean | null
          items?: Json
          last_customer_message_at?: string | null
          last_our_reply_at?: string | null
          lexoffice_contact_id?: string | null
          lexoffice_credit_note_id?: string | null
          lexoffice_document_type?: string | null
          lexoffice_invoice_id?: string | null
          minimum_order_surcharge?: number | null
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string | null
          reference_number?: string | null
          reminder_sent_at?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_catering_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_customer_profiles: {
        Row: {
          billing_city: string | null
          billing_country: string | null
          billing_name: string | null
          billing_street: string | null
          billing_zip: string | null
          company: string | null
          created_at: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_floor: string | null
          delivery_street: string | null
          delivery_zip: string | null
          email: string | null
          has_elevator: boolean | null
          id: string
          name: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          company?: string | null
          created_at?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          email?: string | null
          has_elevator?: boolean | null
          id?: string
          name?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_city?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          company?: string | null
          created_at?: string | null
          delivery_city?: string | null
          delivery_country?: string | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          email?: string | null
          has_elevator?: boolean | null
          id?: string
          name?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_customer_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_email_messages: {
        Row: {
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          created_at: string | null
          direction: string
          from_email: string
          id: string
          in_reply_to: string | null
          inquiry_id: string | null
          resend_message_id: string | null
          resend_status: string | null
          subject: string | null
          tenant_id: string | null
          to_email: string
        }
        Insert: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          direction: string
          from_email: string
          id?: string
          in_reply_to?: string | null
          inquiry_id?: string | null
          resend_message_id?: string | null
          resend_status?: string | null
          subject?: string | null
          tenant_id?: string | null
          to_email: string
        }
        Update: {
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          direction?: string
          from_email?: string
          id?: string
          in_reply_to?: string | null
          inquiry_id?: string | null
          resend_message_id?: string | null
          resend_status?: string | null
          subject?: string | null
          tenant_id?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_email_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "_legacy_event_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_event_bookings: {
        Row: {
          booking_number: string
          company_name: string | null
          created_at: string
          customer_email: string
          customer_name: string
          event_date: string
          event_time: string | null
          guest_count: number
          id: string
          internal_notes: string | null
          lexoffice_contact_id: string | null
          lexoffice_document_type: string | null
          lexoffice_invoice_id: string | null
          location_id: string | null
          menu_confirmed: boolean | null
          menu_selection: Json | null
          package_id: string | null
          payment_status: string | null
          phone: string | null
          source_inquiry_id: string | null
          source_option_id: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link_id: string | null
          tenant_id: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          booking_number: string
          company_name?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          event_date: string
          event_time?: string | null
          guest_count: number
          id?: string
          internal_notes?: string | null
          lexoffice_contact_id?: string | null
          lexoffice_document_type?: string | null
          lexoffice_invoice_id?: string | null
          location_id?: string | null
          menu_confirmed?: boolean | null
          menu_selection?: Json | null
          package_id?: string | null
          payment_status?: string | null
          phone?: string | null
          source_inquiry_id?: string | null
          source_option_id?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          booking_number?: string
          company_name?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          event_date?: string
          event_time?: string | null
          guest_count?: number
          id?: string
          internal_notes?: string | null
          lexoffice_contact_id?: string | null
          lexoffice_document_type?: string | null
          lexoffice_invoice_id?: string | null
          location_id?: string | null
          menu_confirmed?: boolean | null
          menu_selection?: Json | null
          package_id?: string | null
          payment_status?: string | null
          phone?: string | null
          source_inquiry_id?: string | null
          source_option_id?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_id?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_event_bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_source_inquiry_id_fkey"
            columns: ["source_inquiry_id"]
            isOneToOne: false
            referencedRelation: "_legacy_event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_bookings_source_option_id_fkey"
            columns: ["source_option_id"]
            isOneToOne: false
            referencedRelation: "_legacy_inquiry_offer_options"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_event_inquiries: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          billing_address_different: boolean | null
          billing_city: string | null
          billing_company_name: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_street: string | null
          company_city: string | null
          company_country: string | null
          company_name: string | null
          company_postal_code: string | null
          company_street: string | null
          contact_name: string
          converted_to_booking_id: string | null
          created_at: string
          current_offer_version: number | null
          delivery_city: string | null
          delivery_street: string | null
          delivery_time_slot: string | null
          delivery_zip: string | null
          deposit_due_days: number | null
          deposit_percent: number | null
          email: string
          email_draft: string | null
          event_end_date: string | null
          event_type: string | null
          guest_count: string | null
          id: string
          inquiry_type: Database["public"]["Enums"]["inquiry_type"] | null
          internal_notes: string | null
          invoice_due_days: number | null
          is_test: boolean | null
          last_edited_at: string | null
          last_edited_by: string | null
          lexoffice_invoice_id: string | null
          lexoffice_quotation_id: string | null
          location_city: string | null
          location_country: string | null
          location_name: string | null
          location_postal_code: string | null
          location_street: string | null
          location_type: string | null
          menu_selection: Json | null
          message: string | null
          notification_sent: boolean | null
          offer_phase: string | null
          offer_sent_at: string | null
          offer_sent_by: string | null
          offer_slug: string | null
          offer_validity_days: number | null
          paid_amount: number | null
          payment_method: string | null
          payment_type: string | null
          phone: string | null
          preferred_date: string | null
          priority: string | null
          quote_items: Json | null
          quote_notes: string | null
          remaining_amount: number | null
          reminder_count: number | null
          reminder_sent_at: string | null
          room_selection: string | null
          selected_items: Json | null
          selected_option_id: string | null
          selected_packages: Json | null
          source: string | null
          status: string | null
          tenant_id: string | null
          time_slot: string | null
          updated_at: string | null
          venue: string | null
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          billing_address_different?: boolean | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_street?: string | null
          contact_name: string
          converted_to_booking_id?: string | null
          created_at?: string
          current_offer_version?: number | null
          delivery_city?: string | null
          delivery_street?: string | null
          delivery_time_slot?: string | null
          delivery_zip?: string | null
          deposit_due_days?: number | null
          deposit_percent?: number | null
          email: string
          email_draft?: string | null
          event_end_date?: string | null
          event_type?: string | null
          guest_count?: string | null
          id?: string
          inquiry_type?: Database["public"]["Enums"]["inquiry_type"] | null
          internal_notes?: string | null
          invoice_due_days?: number | null
          is_test?: boolean | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lexoffice_invoice_id?: string | null
          lexoffice_quotation_id?: string | null
          location_city?: string | null
          location_country?: string | null
          location_name?: string | null
          location_postal_code?: string | null
          location_street?: string | null
          location_type?: string | null
          menu_selection?: Json | null
          message?: string | null
          notification_sent?: boolean | null
          offer_phase?: string | null
          offer_sent_at?: string | null
          offer_sent_by?: string | null
          offer_slug?: string | null
          offer_validity_days?: number | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_type?: string | null
          phone?: string | null
          preferred_date?: string | null
          priority?: string | null
          quote_items?: Json | null
          quote_notes?: string | null
          remaining_amount?: number | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          room_selection?: string | null
          selected_items?: Json | null
          selected_option_id?: string | null
          selected_packages?: Json | null
          source?: string | null
          status?: string | null
          tenant_id?: string | null
          time_slot?: string | null
          updated_at?: string | null
          venue?: string | null
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          billing_address_different?: boolean | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_street?: string | null
          contact_name?: string
          converted_to_booking_id?: string | null
          created_at?: string
          current_offer_version?: number | null
          delivery_city?: string | null
          delivery_street?: string | null
          delivery_time_slot?: string | null
          delivery_zip?: string | null
          deposit_due_days?: number | null
          deposit_percent?: number | null
          email?: string
          email_draft?: string | null
          event_end_date?: string | null
          event_type?: string | null
          guest_count?: string | null
          id?: string
          inquiry_type?: Database["public"]["Enums"]["inquiry_type"] | null
          internal_notes?: string | null
          invoice_due_days?: number | null
          is_test?: boolean | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          lexoffice_invoice_id?: string | null
          lexoffice_quotation_id?: string | null
          location_city?: string | null
          location_country?: string | null
          location_name?: string | null
          location_postal_code?: string | null
          location_street?: string | null
          location_type?: string | null
          menu_selection?: Json | null
          message?: string | null
          notification_sent?: boolean | null
          offer_phase?: string | null
          offer_sent_at?: string | null
          offer_sent_by?: string | null
          offer_slug?: string | null
          offer_validity_days?: number | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_type?: string | null
          phone?: string | null
          preferred_date?: string | null
          priority?: string | null
          quote_items?: Json | null
          quote_notes?: string | null
          remaining_amount?: number | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          room_selection?: string | null
          selected_items?: Json | null
          selected_option_id?: string | null
          selected_packages?: Json | null
          source?: string | null
          status?: string | null
          tenant_id?: string | null
          time_slot?: string | null
          updated_at?: string | null
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_event_inquiries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_inquiries_converted_to_booking_id_fkey"
            columns: ["converted_to_booking_id"]
            isOneToOne: false
            referencedRelation: "_legacy_event_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_event_payments: {
        Row: {
          amount_cents: number
          created_at: string | null
          created_by: string | null
          due_date: string | null
          due_days_before_event: number | null
          email_resend_id: string | null
          email_sent_at: string | null
          id: string
          inquiry_id: string
          lexoffice_invoice_id: string | null
          lexoffice_invoice_number: string | null
          notes: string | null
          paid_at: string | null
          paid_via: string | null
          payment_type: string
          reminder_sent_at: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link_url: string | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          due_days_before_event?: number | null
          email_resend_id?: string | null
          email_sent_at?: string | null
          id?: string
          inquiry_id: string
          lexoffice_invoice_id?: string | null
          lexoffice_invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_via?: string | null
          payment_type: string
          reminder_sent_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          due_days_before_event?: number | null
          email_resend_id?: string | null
          email_sent_at?: string | null
          id?: string
          inquiry_id?: string
          lexoffice_invoice_id?: string | null
          lexoffice_invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_via?: string | null
          payment_type?: string
          reminder_sent_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_event_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_payments_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "_legacy_event_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_group_inquiries: {
        Row: {
          arrival_time: string | null
          assigned_to: string | null
          company_name: string | null
          contact_name: string
          created_at: string | null
          email: string
          external_id: string | null
          group_size: number
          id: string
          internal_notes: string | null
          language: string | null
          message: string | null
          phone: string | null
          preferred_date: string | null
          preferred_date_flexible: boolean | null
          preferred_menu: string | null
          responded_at: string | null
          source: string | null
          status: string
          tenant_id: string | null
          travel_plan_filename: string | null
          travel_plan_url: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          arrival_time?: string | null
          assigned_to?: string | null
          company_name?: string | null
          contact_name: string
          created_at?: string | null
          email: string
          external_id?: string | null
          group_size: number
          id?: string
          internal_notes?: string | null
          language?: string | null
          message?: string | null
          phone?: string | null
          preferred_date?: string | null
          preferred_date_flexible?: boolean | null
          preferred_menu?: string | null
          responded_at?: string | null
          source?: string | null
          status?: string
          tenant_id?: string | null
          travel_plan_filename?: string | null
          travel_plan_url?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          arrival_time?: string | null
          assigned_to?: string | null
          company_name?: string | null
          contact_name?: string
          created_at?: string | null
          email?: string
          external_id?: string | null
          group_size?: number
          id?: string
          internal_notes?: string | null
          language?: string | null
          message?: string | null
          phone?: string | null
          preferred_date?: string | null
          preferred_date_flexible?: boolean | null
          preferred_menu?: string | null
          responded_at?: string | null
          source?: string | null
          status?: string
          tenant_id?: string | null
          travel_plan_filename?: string | null
          travel_plan_url?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_group_inquiries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_inquiry_comments: {
        Row: {
          author_email: string
          content: string
          created_at: string
          id: string
          inquiry_id: string
          parent_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          author_email: string
          content: string
          created_at?: string
          id?: string
          inquiry_id: string
          parent_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          author_email?: string
          content?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          parent_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_inquiry_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_comments_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "_legacy_event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "_legacy_inquiry_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_inquiry_offer_history: {
        Row: {
          created_at: string
          email_content: string | null
          id: string
          inquiry_id: string
          options_snapshot: Json
          pdf_url: string | null
          sent_at: string
          sent_by: string | null
          tenant_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          email_content?: string | null
          id?: string
          inquiry_id: string
          options_snapshot: Json
          pdf_url?: string | null
          sent_at?: string
          sent_by?: string | null
          tenant_id?: string | null
          version: number
        }
        Update: {
          created_at?: string
          email_content?: string | null
          id?: string
          inquiry_id?: string
          options_snapshot?: Json
          pdf_url?: string | null
          sent_at?: string
          sent_by?: string | null
          tenant_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_inquiry_offer_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_offer_history_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "_legacy_event_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_inquiry_offer_options: {
        Row: {
          created_at: string
          created_in_version: number | null
          guest_count: number
          id: string
          inquiry_id: string
          is_active: boolean | null
          menu_selection: Json | null
          offer_mode: string | null
          offer_version: number
          option_label: string
          package_id: string | null
          selected_quantity: number | null
          sort_order: number | null
          stripe_payment_link_id: string | null
          stripe_payment_link_url: string | null
          tenant_id: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_in_version?: number | null
          guest_count: number
          id?: string
          inquiry_id: string
          is_active?: boolean | null
          menu_selection?: Json | null
          offer_mode?: string | null
          offer_version?: number
          option_label?: string
          package_id?: string | null
          selected_quantity?: number | null
          sort_order?: number | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_in_version?: number | null
          guest_count?: number
          id?: string
          inquiry_id?: string
          is_active?: boolean | null
          menu_selection?: Json | null
          offer_mode?: string | null
          offer_version?: number
          option_label?: string
          package_id?: string | null
          selected_quantity?: number | null
          sort_order?: number | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_inquiry_offer_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_offer_options_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "_legacy_event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_offer_options_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_inquiry_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          inquiry_id: string | null
          priority: string
          reminder_sent: boolean | null
          status: string
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          inquiry_id?: string | null
          priority?: string
          reminder_sent?: boolean | null
          status?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          inquiry_id?: string | null
          priority?: string
          reminder_sent?: boolean | null
          status?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_inquiry_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_tasks_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "_legacy_event_inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      _legacy_offer_customer_responses: {
        Row: {
          created_at: string | null
          customer_notes: string | null
          id: string
          inquiry_id: string
          ip_address: string | null
          responded_at: string | null
          selected_option_id: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          customer_notes?: string | null
          id?: string
          inquiry_id: string
          ip_address?: string | null
          responded_at?: string | null
          selected_option_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          customer_notes?: string | null
          id?: string
          inquiry_id?: string
          ip_address?: string | null
          responded_at?: string | null
          selected_option_id?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "_legacy_offer_customer_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_customer_responses_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "_legacy_event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_customer_responses_selected_option_id_fkey"
            columns: ["selected_option_id"]
            isOneToOne: false
            referencedRelation: "_legacy_inquiry_offer_options"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      admin_presence: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_editing: boolean | null
          last_seen: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_editing?: boolean | null
          last_seen?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_editing?: boolean | null
          last_seen?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          customer_email: string | null
          id: string
          inquiry_id: string | null
          language: string | null
          metadata: Json
          source: string
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          id?: string
          inquiry_id?: string | null
          language?: string | null
          metadata?: Json
          source?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          id?: string
          inquiry_id?: string | null
          language?: string | null
          metadata?: Json
          source?: string
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_extractions: {
        Row: {
          confidence: Json
          conversation_id: string
          created_at: string
          extracted: Json
          id: string
          missing_fields: string[]
          tenant_id: string | null
        }
        Insert: {
          confidence?: Json
          conversation_id: string
          created_at?: string
          extracted?: Json
          id?: string
          missing_fields?: string[]
          tenant_id?: string | null
        }
        Update: {
          confidence?: Json
          conversation_id?: string
          created_at?: string
          extracted?: Json
          id?: string
          missing_fields?: string[]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_extractions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extractions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_extractions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          role: string
          tenant_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
          tenant_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      balance_payment_links: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          customer_email: string
          customer_name: string | null
          default_guests: number
          deposit_paid_cents: number
          event_date: string | null
          event_id: string | null
          event_label: string
          event_label_en: string | null
          id: string
          max_guests: number
          min_guests: number
          notes: string | null
          price_per_person_cents: number
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          customer_email: string
          customer_name?: string | null
          default_guests: number
          deposit_paid_cents?: number
          event_date?: string | null
          event_id?: string | null
          event_label: string
          event_label_en?: string | null
          id?: string
          max_guests?: number
          min_guests?: number
          notes?: string | null
          price_per_person_cents: number
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          customer_email?: string
          customer_name?: string | null
          default_guests?: number
          deposit_paid_cents?: number
          event_date?: string | null
          event_id?: string | null
          event_label?: string
          event_label_en?: string | null
          id?: string
          max_guests?: number
          min_guests?: number
          notes?: string | null
          price_per_person_cents?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      cost_acceptances: {
        Row: {
          amount_gross_cents: number | null
          confirmations: Json
          created_at: string
          currency: string
          customer_number: string | null
          document_markdown_snapshot: string | null
          esignatures_contract_id: string | null
          esignatures_template_id: string | null
          event_company: string | null
          event_date: string | null
          event_title: string | null
          guest_count: number | null
          id: string
          inquiry_id: string
          invoice_company: string | null
          invoice_reference: string | null
          invoice_street: string | null
          invoice_zip_city: string | null
          last_contract_error: string | null
          last_send_error: string | null
          last_send_error_at: string | null
          last_webhook_error: string | null
          mfa_method: string | null
          offer_date: string | null
          offer_number: string | null
          offer_option_id: string | null
          onsite_contact: string | null
          pdf_download_attempts: number
          pdf_download_last_error: string | null
          reference_pdf_name: string | null
          reference_pdf_uploaded_at: string | null
          retry_count: number
          send_count: number
          sent_at: string | null
          sent_message_id: string | null
          sent_to: string | null
          sign_page_url: string | null
          sign_page_url_embedded: string | null
          signed_at: string | null
          signed_pdf_pending: boolean
          signed_pdf_sha256: string | null
          signed_pdf_storage_path: string | null
          signer_company_name: string | null
          signer_email: string | null
          signer_mobile: string | null
          signer_name: string | null
          status: string
          template_version: string | null
          tenant_id: string | null
          updated_at: string
          valid_until: string | null
          webhook_events: Json
        }
        Insert: {
          amount_gross_cents?: number | null
          confirmations?: Json
          created_at?: string
          currency?: string
          customer_number?: string | null
          document_markdown_snapshot?: string | null
          esignatures_contract_id?: string | null
          esignatures_template_id?: string | null
          event_company?: string | null
          event_date?: string | null
          event_title?: string | null
          guest_count?: number | null
          id?: string
          inquiry_id: string
          invoice_company?: string | null
          invoice_reference?: string | null
          invoice_street?: string | null
          invoice_zip_city?: string | null
          last_contract_error?: string | null
          last_send_error?: string | null
          last_send_error_at?: string | null
          last_webhook_error?: string | null
          mfa_method?: string | null
          offer_date?: string | null
          offer_number?: string | null
          offer_option_id?: string | null
          onsite_contact?: string | null
          pdf_download_attempts?: number
          pdf_download_last_error?: string | null
          reference_pdf_name?: string | null
          reference_pdf_uploaded_at?: string | null
          retry_count?: number
          send_count?: number
          sent_at?: string | null
          sent_message_id?: string | null
          sent_to?: string | null
          sign_page_url?: string | null
          sign_page_url_embedded?: string | null
          signed_at?: string | null
          signed_pdf_pending?: boolean
          signed_pdf_sha256?: string | null
          signed_pdf_storage_path?: string | null
          signer_company_name?: string | null
          signer_email?: string | null
          signer_mobile?: string | null
          signer_name?: string | null
          status?: string
          template_version?: string | null
          tenant_id?: string | null
          updated_at?: string
          valid_until?: string | null
          webhook_events?: Json
        }
        Update: {
          amount_gross_cents?: number | null
          confirmations?: Json
          created_at?: string
          currency?: string
          customer_number?: string | null
          document_markdown_snapshot?: string | null
          esignatures_contract_id?: string | null
          esignatures_template_id?: string | null
          event_company?: string | null
          event_date?: string | null
          event_title?: string | null
          guest_count?: number | null
          id?: string
          inquiry_id?: string
          invoice_company?: string | null
          invoice_reference?: string | null
          invoice_street?: string | null
          invoice_zip_city?: string | null
          last_contract_error?: string | null
          last_send_error?: string | null
          last_send_error_at?: string | null
          last_webhook_error?: string | null
          mfa_method?: string | null
          offer_date?: string | null
          offer_number?: string | null
          offer_option_id?: string | null
          onsite_contact?: string | null
          pdf_download_attempts?: number
          pdf_download_last_error?: string | null
          reference_pdf_name?: string | null
          reference_pdf_uploaded_at?: string | null
          retry_count?: number
          send_count?: number
          sent_at?: string | null
          sent_message_id?: string | null
          sent_to?: string | null
          sign_page_url?: string | null
          sign_page_url_embedded?: string | null
          signed_at?: string | null
          signed_pdf_pending?: boolean
          signed_pdf_sha256?: string | null
          signed_pdf_storage_path?: string | null
          signer_company_name?: string | null
          signer_email?: string | null
          signer_mobile?: string | null
          signer_name?: string | null
          status?: string
          template_version?: string | null
          tenant_id?: string | null
          updated_at?: string
          valid_until?: string | null
          webhook_events?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cost_acceptances_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_acceptances_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_acceptances_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_acceptances_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "cost_acceptances_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_acceptances_offer_option_id_fkey"
            columns: ["offer_option_id"]
            isOneToOne: false
            referencedRelation: "inquiry_offer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_acceptances_offer_option_id_fkey"
            columns: ["offer_option_id"]
            isOneToOne: false
            referencedRelation: "offer_customer_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_acceptances_offer_option_id_fkey"
            columns: ["offer_option_id"]
            isOneToOne: false
            referencedRelation: "offer_customer_responses"
            referencedColumns: ["selected_option_id"]
          },
          {
            foreignKeyName: "cost_acceptances_offer_option_id_fkey"
            columns: ["offer_option_id"]
            isOneToOne: false
            referencedRelation: "v2_offer_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_acceptances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_settings: {
        Row: {
          created_at: string
          key: string
          tenant_id: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "crm_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_audits: {
        Row: {
          audit_date: string
          created_at: string
          id: string
          notified: boolean
          project: Database["public"]["Enums"]["project_key"]
          severity_score: number
          summary: Json
        }
        Insert: {
          audit_date: string
          created_at?: string
          id?: string
          notified?: boolean
          project: Database["public"]["Enums"]["project_key"]
          severity_score?: number
          summary: Json
        }
        Update: {
          audit_date?: string
          created_at?: string
          id?: string
          notified?: boolean
          project?: Database["public"]["Enums"]["project_key"]
          severity_score?: number
          summary?: Json
        }
        Relationships: []
      }
      data_purge_audit: {
        Row: {
          affected_count: number
          candidate_count: number
          candidate_ids: Json | null
          created_at: string
          details: Json | null
          error_message: string | null
          finished_at: string | null
          id: string
          mode: string
          policy_id: string | null
          scope: string
          started_at: string
          status: string
          triggered_by: string | null
        }
        Insert: {
          affected_count?: number
          candidate_count?: number
          candidate_ids?: Json | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          mode: string
          policy_id?: string | null
          scope: string
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Update: {
          affected_count?: number
          candidate_count?: number
          candidate_ids?: Json | null
          created_at?: string
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          mode?: string
          policy_id?: string | null
          scope?: string
          started_at?: string
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_purge_audit_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "data_retention_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_policies: {
        Row: {
          batch_limit: number
          created_at: string
          description: string
          dry_run: boolean
          enabled: boolean
          hard_delete_after_days: number | null
          id: string
          last_run_at: string | null
          last_run_candidate_count: number | null
          last_run_mode: string | null
          notes: string | null
          scope: string
          soft_delete_after_days: number | null
          updated_at: string
        }
        Insert: {
          batch_limit?: number
          created_at?: string
          description: string
          dry_run?: boolean
          enabled?: boolean
          hard_delete_after_days?: number | null
          id?: string
          last_run_at?: string | null
          last_run_candidate_count?: number | null
          last_run_mode?: string | null
          notes?: string | null
          scope: string
          soft_delete_after_days?: number | null
          updated_at?: string
        }
        Update: {
          batch_limit?: number
          created_at?: string
          description?: string
          dry_run?: boolean
          enabled?: boolean
          hard_delete_after_days?: number | null
          id?: string
          last_run_at?: string | null
          last_run_candidate_count?: number | null
          last_run_mode?: string | null
          notes?: string | null
          scope?: string
          soft_delete_after_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_attachments: {
        Row: {
          content_id: string | null
          created_at: string
          email_id: string
          filename: string
          id: string
          is_inline: boolean
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          tenant_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          email_id: string
          filename: string
          id?: string
          is_inline?: boolean
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          tenant_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string
          email_id?: string
          filename?: string
          id?: string
          is_inline?: boolean
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "inbox_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "unassigned_inbox_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_classification_feedback: {
        Row: {
          actual_category: string | null
          actual_event_id: string | null
          body_excerpt: string | null
          created_at: string
          email_id: string | null
          from_email: string
          id: string
          subject: string | null
          suggested_category: string | null
          suggested_event_id: string | null
          tenant_id: string | null
          was_correct: boolean | null
        }
        Insert: {
          actual_category?: string | null
          actual_event_id?: string | null
          body_excerpt?: string | null
          created_at?: string
          email_id?: string | null
          from_email: string
          id?: string
          subject?: string | null
          suggested_category?: string | null
          suggested_event_id?: string | null
          tenant_id?: string | null
          was_correct?: boolean | null
        }
        Update: {
          actual_category?: string | null
          actual_event_id?: string | null
          body_excerpt?: string | null
          created_at?: string
          email_id?: string | null
          from_email?: string
          id?: string
          subject?: string | null
          suggested_category?: string | null
          suggested_event_id?: string | null
          tenant_id?: string | null
          was_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "email_classification_feedback_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "inbox_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_classification_feedback_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "unassigned_inbox_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_classification_feedback_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_logs: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          provider: string
          provider_message_id: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          provider_message_id?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          provider_message_id?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_sender_blocklist: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          from_email: string
          reason: string | null
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          from_email: string
          reason?: string | null
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          from_email?: string
          reason?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: string
          content: string
          content_en: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          subject: string
          tenant_id: string | null
          variables: string[] | null
        }
        Insert: {
          category?: string
          content: string
          content_en?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          subject: string
          tenant_id?: string | null
          variables?: string[] | null
        }
        Update: {
          category?: string
          content?: string
          content_en?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          subject?: string
          tenant_id?: string | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_catalog: {
        Row: {
          created_at: string
          default_quantity: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          price_per_unit: number
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_quantity?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          price_per_unit?: number
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_quantity?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          price_per_unit?: number
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      event_email_filters: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          filter_type: string
          filter_value: string
          id: string
          is_active: boolean
          label: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          filter_type: string
          filter_value: string
          id?: string
          is_active?: boolean
          label?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          filter_type?: string
          filter_value?: string
          id?: string
          is_active?: boolean
          label?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_email_filters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_filters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_filters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_filters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_email_filters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_filters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_email_links: {
        Row: {
          created_at: string
          email_id: string
          event_id: string
          excluded_at: string | null
          excluded_by: string | null
          excluded_reason: string | null
          id: string
          is_excluded: boolean
          link_source: string
          matched_filter_id: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          email_id: string
          event_id: string
          excluded_at?: string | null
          excluded_by?: string | null
          excluded_reason?: string | null
          id?: string
          is_excluded?: boolean
          link_source: string
          matched_filter_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          email_id?: string
          event_id?: string
          excluded_at?: string | null
          excluded_by?: string | null
          excluded_reason?: string | null
          id?: string
          is_excluded?: boolean
          link_source?: string
          matched_filter_id?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_email_links_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "inbox_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_links_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "unassigned_inbox_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "event_email_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_links_matched_filter_id_fkey"
            columns: ["matched_filter_id"]
            isOneToOne: false
            referencedRelation: "event_email_filters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_email_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      imap_sync_state: {
        Row: {
          folder_name: string
          imap_folder_path: string | null
          last_error: string | null
          last_error_at: string | null
          last_full_reconcile_at: string | null
          last_sync_at: string | null
          last_uid: number
        }
        Insert: {
          folder_name: string
          imap_folder_path?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_full_reconcile_at?: string | null
          last_sync_at?: string | null
          last_uid?: number
        }
        Update: {
          folder_name?: string
          imap_folder_path?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_full_reconcile_at?: string | null
          last_sync_at?: string | null
          last_uid?: number
        }
        Relationships: []
      }
      inbox_emails: {
        Row: {
          attachment_count: number
          body_html: string | null
          body_text: string | null
          cc_emails: string[]
          created_at: string
          date_received: string
          date_sent: string | null
          direction: string
          draft_uid_key: string | null
          from_email: string
          from_name: string | null
          has_attachments: boolean
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          imap_folder: string
          imap_status: string
          imap_uid: number
          in_reply_to: string | null
          is_hidden: boolean
          message_id: string
          raw_mime: string
          raw_size_bytes: number
          references_headers: string[] | null
          reply_to_email: string | null
          status_changed_at: string | null
          status_history: Json
          subject: string | null
          suggested_event_id: string | null
          suggestion_accepted_at: string | null
          suggestion_actual_event_id: string | null
          suggestion_category: string | null
          suggestion_confidence: string | null
          suggestion_generated_at: string | null
          suggestion_method: string | null
          suggestion_overridden_at: string | null
          suggestion_reasoning: string | null
          tenant_id: string | null
          to_emails: string[]
          updated_at: string
        }
        Insert: {
          attachment_count?: number
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[]
          created_at?: string
          date_received: string
          date_sent?: string | null
          direction?: string
          draft_uid_key?: string | null
          from_email: string
          from_name?: string | null
          has_attachments?: boolean
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          imap_folder?: string
          imap_status?: string
          imap_uid: number
          in_reply_to?: string | null
          is_hidden?: boolean
          message_id: string
          raw_mime: string
          raw_size_bytes: number
          references_headers?: string[] | null
          reply_to_email?: string | null
          status_changed_at?: string | null
          status_history?: Json
          subject?: string | null
          suggested_event_id?: string | null
          suggestion_accepted_at?: string | null
          suggestion_actual_event_id?: string | null
          suggestion_category?: string | null
          suggestion_confidence?: string | null
          suggestion_generated_at?: string | null
          suggestion_method?: string | null
          suggestion_overridden_at?: string | null
          suggestion_reasoning?: string | null
          tenant_id?: string | null
          to_emails?: string[]
          updated_at?: string
        }
        Update: {
          attachment_count?: number
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[]
          created_at?: string
          date_received?: string
          date_sent?: string | null
          direction?: string
          draft_uid_key?: string | null
          from_email?: string
          from_name?: string | null
          has_attachments?: boolean
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          imap_folder?: string
          imap_status?: string
          imap_uid?: number
          in_reply_to?: string | null
          is_hidden?: boolean
          message_id?: string
          raw_mime?: string
          raw_size_bytes?: number
          references_headers?: string[] | null
          reply_to_email?: string | null
          status_changed_at?: string | null
          status_history?: Json
          subject?: string | null
          suggested_event_id?: string | null
          suggestion_accepted_at?: string | null
          suggestion_actual_event_id?: string | null
          suggestion_category?: string | null
          suggestion_confidence?: string | null
          suggestion_generated_at?: string | null
          suggestion_method?: string | null
          suggestion_overridden_at?: string | null
          suggestion_reasoning?: string | null
          tenant_id?: string | null
          to_emails?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_emails_suggested_event_id_fkey"
            columns: ["suggested_event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_emails_suggested_event_id_fkey"
            columns: ["suggested_event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_emails_suggested_event_id_fkey"
            columns: ["suggested_event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_emails_suggested_event_id_fkey"
            columns: ["suggested_event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "inbox_emails_suggested_event_id_fkey"
            columns: ["suggested_event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_emails_suggestion_actual_event_id_fkey"
            columns: ["suggestion_actual_event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_emails_suggestion_actual_event_id_fkey"
            columns: ["suggestion_actual_event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_emails_suggestion_actual_event_id_fkey"
            columns: ["suggestion_actual_event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_emails_suggestion_actual_event_id_fkey"
            columns: ["suggestion_actual_event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "inbox_emails_suggestion_actual_event_id_fkey"
            columns: ["suggestion_actual_event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_attachments: {
        Row: {
          conversation_id: string | null
          created_at: string
          description: string | null
          id: string
          inquiry_id: string | null
          metadata: Json
          mime_type: string | null
          original_filename: string
          size_bytes: number | null
          source: string
          storage_bucket: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          inquiry_id?: string | null
          metadata?: Json
          mime_type?: string | null
          original_filename: string
          size_bytes?: number | null
          source?: string
          storage_bucket: string
          storage_path: string
          uploaded_by?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          inquiry_id?: string | null
          metadata?: Json
          mime_type?: string | null
          original_filename?: string
          size_bytes?: number | null
          source?: string
          storage_bucket?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiry_attachments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: Json | null
          id: string
          metadata: Json
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          document_id: string
          embedding?: Json | null
          id?: string
          metadata?: Json
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: Json | null
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          content: string | null
          content_hash: string | null
          created_at: string
          id: string
          locale: string | null
          metadata: Json
          path: string | null
          source_id: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          locale?: string | null
          metadata?: Json
          path?: string | null
          source_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          content_hash?: string | null
          created_at?: string
          id?: string
          locale?: string | null
          metadata?: Json
          path?: string | null
          source_id?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          created_at: string
          id: string
          last_indexed_at: string | null
          metadata: Json
          source_ref: string | null
          source_type: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_indexed_at?: string | null
          metadata?: Json
          source_ref?: string | null
          source_type: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_indexed_at?: string | null
          metadata?: Json
          source_ref?: string | null
          source_type?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_notify_failures: {
        Row: {
          attempted_at: string
          error_message: string | null
          id: string
          lead_id: string
          resolved_at: string | null
          step: string
          tenant_id: string | null
        }
        Insert: {
          attempted_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          resolved_at?: string | null
          step: string
          tenant_id?: string | null
        }
        Update: {
          attempted_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          resolved_at?: string | null
          step?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notify_failures_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_funnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notify_failures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_funnel: {
        Row: {
          created_at: string
          date_mode: string
          date_range_end: string | null
          date_range_start: string | null
          date_value: string | null
          email: string
          event_inquiry_id: string | null
          first_name: string
          format: string | null
          gdpr_consent: boolean
          gdpr_consent_at: string | null
          id: string
          intent: string
          last_name: string
          lead_score: number
          notes: string | null
          notified_at: string | null
          occasion: string
          occasion_other: string | null
          people_bucket: string
          phone: string | null
          source_url: string | null
          status: string
          tenant_id: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          date_mode: string
          date_range_end?: string | null
          date_range_start?: string | null
          date_value?: string | null
          email: string
          event_inquiry_id?: string | null
          first_name: string
          format?: string | null
          gdpr_consent?: boolean
          gdpr_consent_at?: string | null
          id?: string
          intent: string
          last_name: string
          lead_score?: number
          notes?: string | null
          notified_at?: string | null
          occasion: string
          occasion_other?: string | null
          people_bucket: string
          phone?: string | null
          source_url?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          date_mode?: string
          date_range_end?: string | null
          date_range_start?: string | null
          date_value?: string | null
          email?: string
          event_inquiry_id?: string | null
          first_name?: string
          format?: string | null
          gdpr_consent?: boolean
          gdpr_consent_at?: string | null
          id?: string
          intent?: string
          last_name?: string
          lead_score?: number
          notes?: string | null
          notified_at?: string | null
          occasion?: string
          occasion_other?: string | null
          people_bucket?: string
          phone?: string | null
          source_url?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_funnel_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lexoffice_sync_log: {
        Row: {
          applied: boolean
          conflict: boolean
          created_at: string
          error: string | null
          event_type: string
          id: string
          lexoffice_invoice_id: string | null
          payload: Json | null
          v2_payment_id: string | null
        }
        Insert: {
          applied?: boolean
          conflict?: boolean
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          lexoffice_invoice_id?: string | null
          payload?: Json | null
          v2_payment_id?: string | null
        }
        Update: {
          applied?: boolean
          conflict?: boolean
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          lexoffice_invoice_id?: string | null
          payload?: Json | null
          v2_payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lexoffice_sync_log_v2_payment_id_fkey"
            columns: ["v2_payment_id"]
            isOneToOne: false
            referencedRelation: "event_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexoffice_sync_log_v2_payment_id_fkey"
            columns: ["v2_payment_id"]
            isOneToOne: false
            referencedRelation: "event_payments_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexoffice_sync_log_v2_payment_id_fkey"
            columns: ["v2_payment_id"]
            isOneToOne: false
            referencedRelation: "v2_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lexoffice_sync_log_v2_payment_id_fkey"
            columns: ["v2_payment_id"]
            isOneToOne: false
            referencedRelation: "v2_payments_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          capacity_seated: number | null
          capacity_standing: number | null
          created_at: string | null
          description: string | null
          description_en: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          name: string
          name_en: string | null
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          capacity_seated?: number | null
          capacity_standing?: number | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          name_en?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          capacity_seated?: number | null
          capacity_standing?: number | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_categories: {
        Row: {
          archived_at: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          description_en: string | null
          homepage_slug: string | null
          id: string
          image_url: string | null
          menu_id: string
          name: string
          name_en: string | null
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          description_en?: string | null
          homepage_slug?: string | null
          id?: string
          image_url?: string | null
          menu_id: string
          name: string
          name_en?: string | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          description_en?: string | null
          homepage_slug?: string | null
          id?: string
          image_url?: string | null
          menu_id?: string
          name?: string
          name_en?: string | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string | null
          archived_at: string | null
          category_id: string
          created_at: string | null
          deleted_at: string | null
          description: string | null
          description_en: string | null
          id: string
          image_url: string | null
          is_vegan: boolean | null
          is_vegetarian: boolean | null
          min_order: string | null
          min_order_en: string | null
          name: string
          name_en: string | null
          price: number | null
          price_display: string | null
          serving_info: string | null
          serving_info_en: string | null
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          allergens?: string | null
          archived_at?: string | null
          category_id: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_vegan?: boolean | null
          is_vegetarian?: boolean | null
          min_order?: string | null
          min_order_en?: string | null
          name: string
          name_en?: string | null
          price?: number | null
          price_display?: string | null
          serving_info?: string | null
          serving_info_en?: string | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          allergens?: string | null
          archived_at?: string | null
          category_id?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          description_en?: string | null
          id?: string
          image_url?: string | null
          is_vegan?: boolean | null
          is_vegetarian?: boolean | null
          min_order?: string | null
          min_order_en?: string | null
          name?: string
          name_en?: string | null
          price?: number | null
          price_display?: string | null
          serving_info?: string | null
          serving_info_en?: string | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "menu_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          additional_info: string | null
          additional_info_en: string | null
          created_at: string | null
          id: string
          is_published: boolean | null
          menu_type: Database["public"]["Enums"]["menu_type"]
          pdf_url: string | null
          published_at: string | null
          slug: string | null
          slug_en: string | null
          slug_fr: string | null
          slug_it: string | null
          sort_order: number | null
          subtitle: string | null
          subtitle_en: string | null
          tenant_id: string | null
          title: string | null
          title_en: string | null
          updated_at: string | null
        }
        Insert: {
          additional_info?: string | null
          additional_info_en?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          menu_type: Database["public"]["Enums"]["menu_type"]
          pdf_url?: string | null
          published_at?: string | null
          slug?: string | null
          slug_en?: string | null
          slug_fr?: string | null
          slug_it?: string | null
          sort_order?: number | null
          subtitle?: string | null
          subtitle_en?: string | null
          tenant_id?: string | null
          title?: string | null
          title_en?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_info?: string | null
          additional_info_en?: string | null
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          menu_type?: Database["public"]["Enums"]["menu_type"]
          pdf_url?: string | null
          published_at?: string | null
          slug?: string | null
          slug_en?: string | null
          slug_fr?: string | null
          slug_it?: string | null
          sort_order?: number | null
          subtitle?: string | null
          subtitle_en?: string | null
          tenant_id?: string | null
          title?: string | null
          title_en?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_number_sequences: {
        Row: {
          created_at: string | null
          current_number: number
          id: string
          prefix: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          current_number?: number
          id?: string
          prefix: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          current_number?: number
          id?: string
          prefix?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      package_course_config: {
        Row: {
          allowed_categories: string[] | null
          allowed_sources: string[] | null
          course_label: string
          course_label_en: string | null
          course_label_fr: string | null
          course_label_it: string | null
          course_type: string
          created_at: string | null
          custom_item_description: string | null
          custom_item_description_en: string | null
          custom_item_description_fr: string | null
          custom_item_description_it: string | null
          custom_item_name: string | null
          custom_item_name_en: string | null
          custom_item_name_fr: string | null
          custom_item_name_it: string | null
          id: string
          is_custom_item: boolean | null
          is_required: boolean | null
          package_id: string
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          allowed_categories?: string[] | null
          allowed_sources?: string[] | null
          course_label: string
          course_label_en?: string | null
          course_label_fr?: string | null
          course_label_it?: string | null
          course_type: string
          created_at?: string | null
          custom_item_description?: string | null
          custom_item_description_en?: string | null
          custom_item_description_fr?: string | null
          custom_item_description_it?: string | null
          custom_item_name?: string | null
          custom_item_name_en?: string | null
          custom_item_name_fr?: string | null
          custom_item_name_it?: string | null
          id?: string
          is_custom_item?: boolean | null
          is_required?: boolean | null
          package_id: string
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          allowed_categories?: string[] | null
          allowed_sources?: string[] | null
          course_label?: string
          course_label_en?: string | null
          course_label_fr?: string | null
          course_label_it?: string | null
          course_type?: string
          created_at?: string | null
          custom_item_description?: string | null
          custom_item_description_en?: string | null
          custom_item_description_fr?: string | null
          custom_item_description_it?: string | null
          custom_item_name?: string | null
          custom_item_name_en?: string | null
          custom_item_name_fr?: string | null
          custom_item_name_it?: string | null
          id?: string
          is_custom_item?: boolean | null
          is_required?: boolean | null
          package_id?: string
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_course_config_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_course_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      package_drink_config: {
        Row: {
          created_at: string | null
          drink_group: string
          drink_label: string
          drink_label_en: string | null
          drink_label_fr: string | null
          drink_label_it: string | null
          id: string
          is_choice: boolean | null
          is_included: boolean | null
          options: Json | null
          options_translations: Json | null
          package_id: string
          quantity_label: string | null
          quantity_label_en: string | null
          quantity_label_fr: string | null
          quantity_label_it: string | null
          quantity_per_person: string | null
          sort_order: number | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          drink_group: string
          drink_label: string
          drink_label_en?: string | null
          drink_label_fr?: string | null
          drink_label_it?: string | null
          id?: string
          is_choice?: boolean | null
          is_included?: boolean | null
          options?: Json | null
          options_translations?: Json | null
          package_id: string
          quantity_label?: string | null
          quantity_label_en?: string | null
          quantity_label_fr?: string | null
          quantity_label_it?: string | null
          quantity_per_person?: string | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          drink_group?: string
          drink_label?: string
          drink_label_en?: string | null
          drink_label_fr?: string | null
          drink_label_it?: string | null
          id?: string
          is_choice?: boolean | null
          is_included?: boolean | null
          options?: Json | null
          options_translations?: Json | null
          package_id?: string
          quantity_label?: string | null
          quantity_label_en?: string | null
          quantity_label_fr?: string | null
          quantity_label_it?: string | null
          quantity_per_person?: string | null
          sort_order?: number | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_drink_config_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_drink_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      package_locations: {
        Row: {
          created_at: string | null
          id: string
          location_id: string
          package_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          location_id: string
          package_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          location_id?: string
          package_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_locations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      package_menu_items: {
        Row: {
          created_at: string | null
          id: string
          is_included: boolean | null
          item_id: string
          item_name: string
          item_price: number | null
          item_source: string
          package_id: string
          quantity: number
          sort_order: number | null
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_included?: boolean | null
          item_id: string
          item_name: string
          item_price?: number | null
          item_source: string
          package_id: string
          quantity?: number
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_included?: boolean | null
          item_id?: string
          item_name?: string
          item_price?: number | null
          item_source?: string
          package_id?: string
          quantity?: number
          sort_order?: number | null
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_menu_items_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_menu_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string | null
          currency: string | null
          description: string | null
          description_en: string | null
          duration_minutes: number | null
          extras_available: Json | null
          id: string
          includes: Json | null
          is_active: boolean | null
          language_support: Json | null
          max_guests: number | null
          min_guests: number | null
          name: string
          name_en: string | null
          package_type: string
          prepayment_percentage: number | null
          price: number
          price_per_person: boolean | null
          pricing_tiers: Json | null
          pricing_type: string | null
          requires_prepayment: boolean | null
          sort_order: number | null
          subtitle: string | null
          target_groups: Json | null
          tenant_id: string | null
          updated_at: string | null
          visible_on_website: boolean | null
          website_menu_key: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_en?: string | null
          duration_minutes?: number | null
          extras_available?: Json | null
          id?: string
          includes?: Json | null
          is_active?: boolean | null
          language_support?: Json | null
          max_guests?: number | null
          min_guests?: number | null
          name: string
          name_en?: string | null
          package_type?: string
          prepayment_percentage?: number | null
          price?: number
          price_per_person?: boolean | null
          pricing_tiers?: Json | null
          pricing_type?: string | null
          requires_prepayment?: boolean | null
          sort_order?: number | null
          subtitle?: string | null
          target_groups?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
          visible_on_website?: boolean | null
          website_menu_key?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          description?: string | null
          description_en?: string | null
          duration_minutes?: number | null
          extras_available?: Json | null
          id?: string
          includes?: Json | null
          is_active?: boolean | null
          language_support?: Json | null
          max_guests?: number | null
          min_guests?: number | null
          name?: string
          name_en?: string | null
          package_type?: string
          prepayment_percentage?: number | null
          price?: number
          price_per_person?: boolean | null
          pricing_tiers?: Json | null
          pricing_type?: string | null
          requires_prepayment?: boolean | null
          sort_order?: number | null
          subtitle?: string | null
          target_groups?: Json | null
          tenant_id?: string | null
          updated_at?: string | null
          visible_on_website?: boolean | null
          website_menu_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_album: {
        Row: {
          ai_classified: boolean
          ai_confidence: number | null
          ai_error: string | null
          ai_model: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          file_size: number | null
          filename: string | null
          height: number | null
          id: string
          is_archived: boolean
          is_current: boolean
          parent_photo_id: string | null
          source_filename: string | null
          source_origin: string | null
          storage_path: string
          tags: string[]
          title: string | null
          updated_at: string
          url: string
          version: number
          width: number | null
        }
        Insert: {
          ai_classified?: boolean
          ai_confidence?: number | null
          ai_error?: string | null
          ai_model?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          filename?: string | null
          height?: number | null
          id?: string
          is_archived?: boolean
          is_current?: boolean
          parent_photo_id?: string | null
          source_filename?: string | null
          source_origin?: string | null
          storage_path: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          url: string
          version?: number
          width?: number | null
        }
        Update: {
          ai_classified?: boolean
          ai_confidence?: number | null
          ai_error?: string | null
          ai_model?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          file_size?: number | null
          filename?: string | null
          height?: number | null
          id?: string
          is_archived?: boolean
          is_current?: boolean
          parent_photo_id?: string | null
          source_filename?: string | null
          source_origin?: string | null
          storage_path?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          url?: string
          version?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_album_parent_photo_id_fkey"
            columns: ["parent_photo_id"]
            isOneToOne: false
            referencedRelation: "photo_album"
            referencedColumns: ["id"]
          },
        ]
      }
      review_request_log: {
        Row: {
          created_at: string
          error_message: string | null
          event_id: string | null
          id: string
          language: string | null
          message_id: string | null
          provider: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          source: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          language?: string | null
          message_id?: string | null
          provider?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          source: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          language?: string | null
          message_id?: string | null
          provider?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          source?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_request_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_request_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_request_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_request_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "review_request_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_request_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      review_request_settings: {
        Row: {
          bcc_email: string
          delay_business_days: number
          enabled: boolean
          google_review_url: string
          id: boolean
          last_run_at: string | null
          last_run_error: string | null
          last_run_sent_count: number | null
          last_run_skipped_count: number | null
          scope_events: boolean
          scope_orders: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bcc_email?: string
          delay_business_days?: number
          enabled?: boolean
          google_review_url?: string
          id?: boolean
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_sent_count?: number | null
          last_run_skipped_count?: number | null
          scope_events?: boolean
          scope_orders?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bcc_email?: string
          delay_business_days?: number
          enabled?: boolean
          google_review_url?: string
          id?: boolean
          last_run_at?: string | null
          last_run_error?: string | null
          last_run_sent_count?: number | null
          last_run_skipped_count?: number | null
          scope_events?: boolean
          scope_orders?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      review_request_unsubscribes: {
        Row: {
          email: string
          source: string | null
          unsubscribed_at: string
        }
        Insert: {
          email: string
          source?: string | null
          unsubscribed_at?: string
        }
        Update: {
          email?: string
          source?: string | null
          unsubscribed_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_catalog: {
        Row: {
          created_at: string
          default_quantity: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          price_per_unit: number
          sort_order: number
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_quantity?: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          price_per_unit?: number
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_quantity?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          price_per_unit?: number
          sort_order?: number
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      system_errors: {
        Row: {
          count: number
          created_at: string
          escalated_at: string | null
          first_seen: string
          id: string
          last_seen: string
          message: string
          payload: Json | null
          payload_hash: string
          project: Database["public"]["Enums"]["project_key"]
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          url: string | null
          user_agent: string | null
        }
        Insert: {
          count?: number
          created_at?: string
          escalated_at?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          message: string
          payload?: Json | null
          payload_hash: string
          project: Database["public"]["Enums"]["project_key"]
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source: string
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          count?: number
          created_at?: string
          escalated_at?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          message?: string
          payload?: Json | null
          payload_hash?: string
          project?: Database["public"]["Enums"]["project_key"]
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          url?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      system_health_audit_runs: {
        Row: {
          created_at: string
          email_id: string | null
          email_sent: boolean
          had_blockers: boolean
          id: string
          run_at: string
          summary: Json
          triggered_by: string
          window_hours: number
        }
        Insert: {
          created_at?: string
          email_id?: string | null
          email_sent?: boolean
          had_blockers?: boolean
          id?: string
          run_at?: string
          summary?: Json
          triggered_by?: string
          window_hours?: number
        }
        Update: {
          created_at?: string
          email_id?: string | null
          email_sent?: boolean
          had_blockers?: boolean
          id?: string
          run_at?: string
          summary?: Json
          triggered_by?: string
          window_hours?: number
        }
        Relationships: []
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address_city: string | null
          address_street: string | null
          address_zip: string | null
          brand_name: string | null
          contact_email: string | null
          created_at: string
          from_email: string | null
          id: string
          is_default: boolean
          legal_name: string | null
          lexoffice_api_key_ref: string | null
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          registration_number: string | null
          reply_to_email: string | null
          slug: string
          status: string
          stripe_account_id: string | null
          updated_at: string
          vat_id: string | null
          website: string | null
        }
        Insert: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          brand_name?: string | null
          contact_email?: string | null
          created_at?: string
          from_email?: string | null
          id?: string
          is_default?: boolean
          legal_name?: string | null
          lexoffice_api_key_ref?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          registration_number?: string | null
          reply_to_email?: string | null
          slug: string
          status?: string
          stripe_account_id?: string | null
          updated_at?: string
          vat_id?: string | null
          website?: string | null
        }
        Update: {
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          brand_name?: string | null
          contact_email?: string | null
          created_at?: string
          from_email?: string | null
          id?: string
          is_default?: boolean
          legal_name?: string | null
          lexoffice_api_key_ref?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          registration_number?: string | null
          reply_to_email?: string | null
          slug?: string
          status?: string
          stripe_account_id?: string | null
          updated_at?: string
          vat_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      v2_customers: {
        Row: {
          account_activated_at: string | null
          account_invited_at: string | null
          account_invited_by: string | null
          address_city: string | null
          address_street: string | null
          address_zip: string | null
          auth_user_id: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          internal_notes: string | null
          lexoffice_contact_id: string | null
          merged_into_id: string | null
          name: string
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          account_activated_at?: string | null
          account_invited_at?: string | null
          account_invited_by?: string | null
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          auth_user_id?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          internal_notes?: string | null
          lexoffice_contact_id?: string | null
          merged_into_id?: string | null
          name: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          account_activated_at?: string | null
          account_invited_at?: string | null
          account_invited_by?: string | null
          address_city?: string | null
          address_street?: string | null
          address_zip?: string | null
          auth_user_id?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          internal_notes?: string | null
          lexoffice_contact_id?: string | null
          merged_into_id?: string | null
          name?: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_customers_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_customers_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "v2_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_event_changelog: {
        Row: {
          changed_at: string
          changed_by: string
          event_id: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          source: string | null
          tenant_id: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string
          event_id: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          source?: string | null
          tenant_id?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          event_id?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          source?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_event_changelog_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_changelog_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_changelog_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_changelog_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_event_changelog_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_changelog_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_event_comments: {
        Row: {
          author_email: string
          content: string
          created_at: string
          event_id: string
          id: string
          parent_id: string | null
          source_comment_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          author_email: string
          content: string
          created_at?: string
          event_id: string
          id?: string
          parent_id?: string | null
          source_comment_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          author_email?: string
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          parent_id?: string | null
          source_comment_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inquiry_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v2_event_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_event_emails: {
        Row: {
          attachments: Json | null
          bcc_email: string | null
          body_html: string | null
          body_text: string | null
          cc_email: string | null
          created_at: string
          direction: Database["public"]["Enums"]["v2_email_direction"]
          event_id: string | null
          from_email: string
          id: string
          in_reply_to: string | null
          received_at: string | null
          resend_message_id: string | null
          resend_status: string | null
          sent_at: string | null
          source_message_id: string | null
          subject: string | null
          tenant_id: string | null
          to_email: string
        }
        Insert: {
          attachments?: Json | null
          bcc_email?: string | null
          body_html?: string | null
          body_text?: string | null
          cc_email?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["v2_email_direction"]
          event_id?: string | null
          from_email: string
          id?: string
          in_reply_to?: string | null
          received_at?: string | null
          resend_message_id?: string | null
          resend_status?: string | null
          sent_at?: string | null
          source_message_id?: string | null
          subject?: string | null
          tenant_id?: string | null
          to_email: string
        }
        Update: {
          attachments?: Json | null
          bcc_email?: string | null
          body_html?: string | null
          body_text?: string | null
          cc_email?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["v2_email_direction"]
          event_id?: string | null
          from_email?: string
          id?: string
          in_reply_to?: string | null
          received_at?: string | null
          resend_message_id?: string | null
          resend_status?: string | null
          sent_at?: string | null
          source_message_id?: string | null
          subject?: string | null
          tenant_id?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_emails_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_event_offer_history: {
        Row: {
          created_at: string
          email_content: string | null
          email_html: string | null
          event_id: string
          id: string
          options_snapshot: Json
          pdf_url: string | null
          sent_at: string
          sent_by: string | null
          source_history_id: string | null
          tenant_id: string | null
          version: number
        }
        Insert: {
          created_at?: string
          email_content?: string | null
          email_html?: string | null
          event_id: string
          id?: string
          options_snapshot: Json
          pdf_url?: string | null
          sent_at?: string
          sent_by?: string | null
          source_history_id?: string | null
          tenant_id?: string | null
          version: number
        }
        Update: {
          created_at?: string
          email_content?: string | null
          email_html?: string | null
          event_id?: string
          id?: string
          options_snapshot?: Json
          pdf_url?: string | null
          sent_at?: string
          sent_by?: string | null
          source_history_id?: string | null
          tenant_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_offer_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_event_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          event_id: string | null
          id: string
          priority: Database["public"]["Enums"]["v2_event_priority"]
          reminder_sent: boolean | null
          source_task_id: string | null
          status: Database["public"]["Enums"]["v2_task_status"]
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["v2_event_priority"]
          reminder_sent?: boolean | null
          source_task_id?: string | null
          status?: Database["public"]["Enums"]["v2_task_status"]
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["v2_event_priority"]
          reminder_sent?: boolean | null
          source_task_id?: string | null
          status?: Database["public"]["Enums"]["v2_task_status"]
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_events: {
        Row: {
          amount_total: number | null
          archived: boolean | null
          archived_at: string | null
          archived_by: string | null
          arrival_time: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          balance_due_days_before_event: number | null
          balance_method: string | null
          billing_address_different: boolean | null
          billing_city: string | null
          billing_company_name: string | null
          billing_country: string | null
          billing_name: string | null
          billing_postal_code: string | null
          billing_street: string | null
          booking_number: string | null
          calculated_distance_km: number | null
          company_city: string | null
          company_country: string | null
          company_name: string | null
          company_postal_code: string | null
          company_street: string | null
          confirmation_email_sent_at: string | null
          cost_acceptance_id: string | null
          created_at: string
          created_by: string | null
          current_offer_version: number | null
          customer_id: string
          customer_language: string
          customer_notes: string | null
          date: string | null
          date_end: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_cost_cents: number | null
          delivery_floor: string | null
          delivery_street: string | null
          delivery_zip: string | null
          deposit_amount: number | null
          deposit_due_days: number | null
          deposit_method: string | null
          deposit_percent: number | null
          email_content_translations: Json | null
          email_draft: string | null
          event_end_date: string | null
          event_time: string | null
          final_lexoffice_invoice_id: string | null
          final_lexoffice_invoice_number: string | null
          guest_count: number | null
          guest_count_max: number | null
          has_elevator: boolean | null
          id: string
          internal_notes: string | null
          invoice_due_days: number | null
          invoice_email_sent_at: string | null
          invoice_email_sent_by: string | null
          invoice_lexoffice_id: string | null
          invoice_lexoffice_number: string | null
          is_pickup: boolean | null
          is_test: boolean | null
          items: Json | null
          language: string | null
          last_edited_at: string | null
          last_edited_by: string | null
          last_translated_language: string | null
          lexoffice_document_type: string | null
          lexoffice_quotation_id: string | null
          location: Database["public"]["Enums"]["v2_event_location"] | null
          location_city: string | null
          location_country: string | null
          location_details: string | null
          location_id: string | null
          location_name: string | null
          location_postal_code: string | null
          location_street: string | null
          location_type: string | null
          locked_after_signature: boolean
          loss_reason: string | null
          loss_reason_note: string | null
          menu_confirmed: boolean | null
          menu_confirmed_at: string | null
          menu_selection: Json | null
          metadata: Json
          minimum_order_surcharge_cents: number | null
          notification_sent: boolean | null
          number: string | null
          occasion: string | null
          offer_first_viewed_at: string | null
          offer_last_viewed_at: string | null
          offer_phase: string | null
          offer_sent_at: string | null
          offer_sent_by: string | null
          offer_slug: string | null
          offer_validity_days: number | null
          offer_view_count: number
          order_confirmation_terms_version: string | null
          order_confirmed_admin_email: string | null
          order_confirmed_admin_id: string | null
          order_confirmed_at: string | null
          order_confirmed_by_name: string | null
          order_confirmed_internal_note: string | null
          order_confirmed_ip: string | null
          order_confirmed_user_agent: string | null
          order_confirmed_version: number | null
          order_confirmed_via: string | null
          package_id: string | null
          payment_method: string | null
          payment_timing: string | null
          payment_type: string | null
          preferred_date_flexible: boolean | null
          preferred_menu: string | null
          priority: Database["public"]["Enums"]["v2_event_priority"] | null
          quote_items: Json | null
          quote_notes: string | null
          reminder_count: number | null
          reminder_sent_at: string | null
          selected_items: Json | null
          selected_packages: Json | null
          service_type: Database["public"]["Enums"]["v2_event_service"] | null
          source: Database["public"]["Enums"]["v2_event_source"]
          source_booking_id: string | null
          source_catering_id: string | null
          source_inquiry_id: string | null
          status: Database["public"]["Enums"]["v2_event_status"]
          status_changed_at: string | null
          tenant_id: string | null
          time_from: string | null
          time_to: string | null
          travel_plan_filename: string | null
          travel_plan_url: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          amount_total?: number | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          arrival_time?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          balance_due_days_before_event?: number | null
          balance_method?: string | null
          billing_address_different?: boolean | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          booking_number?: string | null
          calculated_distance_km?: number | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_street?: string | null
          confirmation_email_sent_at?: string | null
          cost_acceptance_id?: string | null
          created_at?: string
          created_by?: string | null
          current_offer_version?: number | null
          customer_id: string
          customer_language?: string
          customer_notes?: string | null
          date?: string | null
          date_end?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_cost_cents?: number | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          deposit_amount?: number | null
          deposit_due_days?: number | null
          deposit_method?: string | null
          deposit_percent?: number | null
          email_content_translations?: Json | null
          email_draft?: string | null
          event_end_date?: string | null
          event_time?: string | null
          final_lexoffice_invoice_id?: string | null
          final_lexoffice_invoice_number?: string | null
          guest_count?: number | null
          guest_count_max?: number | null
          has_elevator?: boolean | null
          id?: string
          internal_notes?: string | null
          invoice_due_days?: number | null
          invoice_email_sent_at?: string | null
          invoice_email_sent_by?: string | null
          invoice_lexoffice_id?: string | null
          invoice_lexoffice_number?: string | null
          is_pickup?: boolean | null
          is_test?: boolean | null
          items?: Json | null
          language?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_translated_language?: string | null
          lexoffice_document_type?: string | null
          lexoffice_quotation_id?: string | null
          location?: Database["public"]["Enums"]["v2_event_location"] | null
          location_city?: string | null
          location_country?: string | null
          location_details?: string | null
          location_id?: string | null
          location_name?: string | null
          location_postal_code?: string | null
          location_street?: string | null
          location_type?: string | null
          locked_after_signature?: boolean
          loss_reason?: string | null
          loss_reason_note?: string | null
          menu_confirmed?: boolean | null
          menu_confirmed_at?: string | null
          menu_selection?: Json | null
          metadata?: Json
          minimum_order_surcharge_cents?: number | null
          notification_sent?: boolean | null
          number?: string | null
          occasion?: string | null
          offer_first_viewed_at?: string | null
          offer_last_viewed_at?: string | null
          offer_phase?: string | null
          offer_sent_at?: string | null
          offer_sent_by?: string | null
          offer_slug?: string | null
          offer_validity_days?: number | null
          offer_view_count?: number
          order_confirmation_terms_version?: string | null
          order_confirmed_admin_email?: string | null
          order_confirmed_admin_id?: string | null
          order_confirmed_at?: string | null
          order_confirmed_by_name?: string | null
          order_confirmed_internal_note?: string | null
          order_confirmed_ip?: string | null
          order_confirmed_user_agent?: string | null
          order_confirmed_version?: number | null
          order_confirmed_via?: string | null
          package_id?: string | null
          payment_method?: string | null
          payment_timing?: string | null
          payment_type?: string | null
          preferred_date_flexible?: boolean | null
          preferred_menu?: string | null
          priority?: Database["public"]["Enums"]["v2_event_priority"] | null
          quote_items?: Json | null
          quote_notes?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          selected_items?: Json | null
          selected_packages?: Json | null
          service_type?: Database["public"]["Enums"]["v2_event_service"] | null
          source: Database["public"]["Enums"]["v2_event_source"]
          source_booking_id?: string | null
          source_catering_id?: string | null
          source_inquiry_id?: string | null
          status?: Database["public"]["Enums"]["v2_event_status"]
          status_changed_at?: string | null
          tenant_id?: string | null
          time_from?: string | null
          time_to?: string | null
          travel_plan_filename?: string | null
          travel_plan_url?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          amount_total?: number | null
          archived?: boolean | null
          archived_at?: string | null
          archived_by?: string | null
          arrival_time?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to?: string | null
          balance_due_days_before_event?: number | null
          balance_method?: string | null
          billing_address_different?: boolean | null
          billing_city?: string | null
          billing_company_name?: string | null
          billing_country?: string | null
          billing_name?: string | null
          billing_postal_code?: string | null
          billing_street?: string | null
          booking_number?: string | null
          calculated_distance_km?: number | null
          company_city?: string | null
          company_country?: string | null
          company_name?: string | null
          company_postal_code?: string | null
          company_street?: string | null
          confirmation_email_sent_at?: string | null
          cost_acceptance_id?: string | null
          created_at?: string
          created_by?: string | null
          current_offer_version?: number | null
          customer_id?: string
          customer_language?: string
          customer_notes?: string | null
          date?: string | null
          date_end?: string | null
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_cost_cents?: number | null
          delivery_floor?: string | null
          delivery_street?: string | null
          delivery_zip?: string | null
          deposit_amount?: number | null
          deposit_due_days?: number | null
          deposit_method?: string | null
          deposit_percent?: number | null
          email_content_translations?: Json | null
          email_draft?: string | null
          event_end_date?: string | null
          event_time?: string | null
          final_lexoffice_invoice_id?: string | null
          final_lexoffice_invoice_number?: string | null
          guest_count?: number | null
          guest_count_max?: number | null
          has_elevator?: boolean | null
          id?: string
          internal_notes?: string | null
          invoice_due_days?: number | null
          invoice_email_sent_at?: string | null
          invoice_email_sent_by?: string | null
          invoice_lexoffice_id?: string | null
          invoice_lexoffice_number?: string | null
          is_pickup?: boolean | null
          is_test?: boolean | null
          items?: Json | null
          language?: string | null
          last_edited_at?: string | null
          last_edited_by?: string | null
          last_translated_language?: string | null
          lexoffice_document_type?: string | null
          lexoffice_quotation_id?: string | null
          location?: Database["public"]["Enums"]["v2_event_location"] | null
          location_city?: string | null
          location_country?: string | null
          location_details?: string | null
          location_id?: string | null
          location_name?: string | null
          location_postal_code?: string | null
          location_street?: string | null
          location_type?: string | null
          locked_after_signature?: boolean
          loss_reason?: string | null
          loss_reason_note?: string | null
          menu_confirmed?: boolean | null
          menu_confirmed_at?: string | null
          menu_selection?: Json | null
          metadata?: Json
          minimum_order_surcharge_cents?: number | null
          notification_sent?: boolean | null
          number?: string | null
          occasion?: string | null
          offer_first_viewed_at?: string | null
          offer_last_viewed_at?: string | null
          offer_phase?: string | null
          offer_sent_at?: string | null
          offer_sent_by?: string | null
          offer_slug?: string | null
          offer_validity_days?: number | null
          offer_view_count?: number
          order_confirmation_terms_version?: string | null
          order_confirmed_admin_email?: string | null
          order_confirmed_admin_id?: string | null
          order_confirmed_at?: string | null
          order_confirmed_by_name?: string | null
          order_confirmed_internal_note?: string | null
          order_confirmed_ip?: string | null
          order_confirmed_user_agent?: string | null
          order_confirmed_version?: number | null
          order_confirmed_via?: string | null
          package_id?: string | null
          payment_method?: string | null
          payment_timing?: string | null
          payment_type?: string | null
          preferred_date_flexible?: boolean | null
          preferred_menu?: string | null
          priority?: Database["public"]["Enums"]["v2_event_priority"] | null
          quote_items?: Json | null
          quote_notes?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          selected_items?: Json | null
          selected_packages?: Json | null
          service_type?: Database["public"]["Enums"]["v2_event_service"] | null
          source?: Database["public"]["Enums"]["v2_event_source"]
          source_booking_id?: string | null
          source_catering_id?: string | null
          source_inquiry_id?: string | null
          status?: Database["public"]["Enums"]["v2_event_status"]
          status_changed_at?: string | null
          tenant_id?: string | null
          time_from?: string | null
          time_to?: string | null
          travel_plan_filename?: string | null
          travel_plan_url?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_events_cost_acceptance_id_fkey"
            columns: ["cost_acceptance_id"]
            isOneToOne: false
            referencedRelation: "cost_acceptances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v2_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_offer_options: {
        Row: {
          adjusted_at: string | null
          adjusted_by_email: string | null
          adjustment_reason: string | null
          amount_total: number
          chosen_at: string | null
          chosen_by_email: string | null
          chosen_notes: string | null
          created_at: string
          event_id: string
          guest_count: number
          id: string
          is_active: boolean | null
          is_chosen: boolean | null
          is_outdated: boolean | null
          label: string
          menu_selection: Json | null
          offer_mode: Database["public"]["Enums"]["v2_offer_mode"] | null
          outdated_reason: string | null
          package_id: string | null
          package_name_snapshot: string | null
          post_acceptance_adjustment: boolean
          sort_order: number | null
          source_option_id: string | null
          stripe_payment_link_id: string | null
          stripe_payment_link_url: string | null
          tenant_id: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by_email?: string | null
          adjustment_reason?: string | null
          amount_total: number
          chosen_at?: string | null
          chosen_by_email?: string | null
          chosen_notes?: string | null
          created_at?: string
          event_id: string
          guest_count: number
          id?: string
          is_active?: boolean | null
          is_chosen?: boolean | null
          is_outdated?: boolean | null
          label?: string
          menu_selection?: Json | null
          offer_mode?: Database["public"]["Enums"]["v2_offer_mode"] | null
          outdated_reason?: string | null
          package_id?: string | null
          package_name_snapshot?: string | null
          post_acceptance_adjustment?: boolean
          sort_order?: number | null
          source_option_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by_email?: string | null
          adjustment_reason?: string | null
          amount_total?: number
          chosen_at?: string | null
          chosen_by_email?: string | null
          chosen_notes?: string | null
          created_at?: string
          event_id?: string
          guest_count?: number
          id?: string
          is_active?: boolean | null
          is_chosen?: boolean | null
          is_outdated?: boolean | null
          label?: string
          menu_selection?: Json | null
          offer_mode?: Database["public"]["Enums"]["v2_offer_mode"] | null
          outdated_reason?: string | null
          package_id?: string | null
          package_name_snapshot?: string | null
          post_acceptance_adjustment?: boolean
          sort_order?: number | null
          source_option_id?: string | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_payments: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          due_date: string | null
          due_days_before_event: number | null
          email_resend_id: string | null
          email_sent_at: string | null
          event_id: string
          id: string
          lexoffice_conflict_details: Json | null
          lexoffice_invoice_id: string | null
          lexoffice_invoice_number: string | null
          lexoffice_last_synced_at: string | null
          lexoffice_remote_status: string | null
          lexoffice_remote_total_cents: number | null
          lexoffice_remote_version: number | null
          lexoffice_sync_conflict: boolean
          notes: string | null
          paid_at: string | null
          paid_via: string | null
          payment_type: Database["public"]["Enums"]["v2_payment_type"]
          reminder_sent_at: string | null
          source_booking_payment_id: string | null
          source_offer_option_id: string | null
          source_payment_id: string | null
          status: Database["public"]["Enums"]["v2_payment_status"]
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link_url: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          due_days_before_event?: number | null
          email_resend_id?: string | null
          email_sent_at?: string | null
          event_id: string
          id?: string
          lexoffice_conflict_details?: Json | null
          lexoffice_invoice_id?: string | null
          lexoffice_invoice_number?: string | null
          lexoffice_last_synced_at?: string | null
          lexoffice_remote_status?: string | null
          lexoffice_remote_total_cents?: number | null
          lexoffice_remote_version?: number | null
          lexoffice_sync_conflict?: boolean
          notes?: string | null
          paid_at?: string | null
          paid_via?: string | null
          payment_type: Database["public"]["Enums"]["v2_payment_type"]
          reminder_sent_at?: string | null
          source_booking_payment_id?: string | null
          source_offer_option_id?: string | null
          source_payment_id?: string | null
          status?: Database["public"]["Enums"]["v2_payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          due_days_before_event?: number | null
          email_resend_id?: string | null
          email_sent_at?: string | null
          event_id?: string
          id?: string
          lexoffice_conflict_details?: Json | null
          lexoffice_invoice_id?: string | null
          lexoffice_invoice_number?: string | null
          lexoffice_last_synced_at?: string | null
          lexoffice_remote_status?: string | null
          lexoffice_remote_total_cents?: number | null
          lexoffice_remote_version?: number | null
          lexoffice_sync_conflict?: boolean
          notes?: string | null
          paid_at?: string | null
          paid_via?: string | null
          payment_type?: Database["public"]["Enums"]["v2_payment_type"]
          reminder_sent_at?: string | null
          source_booking_payment_id?: string | null
          source_offer_option_id?: string | null
          source_payment_id?: string | null
          status?: Database["public"]["Enums"]["v2_payment_status"]
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_url?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          amount_cents: number
          code: string
          created_at: string
          currency: string
          id: string
          lexoffice_invoice_id: string | null
          message: string | null
          notes: string | null
          paid_at: string | null
          pdf_url: string | null
          purchaser_email: string
          purchaser_name: string | null
          recipient_email: string | null
          recipient_name: string | null
          redeemed_at: string | null
          redeemed_by_admin: string | null
          status: string
          stripe_session_id: string | null
          tenant_id: string | null
          valid_until: string
        }
        Insert: {
          amount_cents: number
          code: string
          created_at?: string
          currency?: string
          id?: string
          lexoffice_invoice_id?: string | null
          message?: string | null
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          purchaser_email: string
          purchaser_name?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          redeemed_at?: string | null
          redeemed_by_admin?: string | null
          status?: string
          stripe_session_id?: string | null
          tenant_id?: string | null
          valid_until: string
        }
        Update: {
          amount_cents?: number
          code?: string
          created_at?: string
          currency?: string
          id?: string
          lexoffice_invoice_id?: string | null
          message?: string | null
          notes?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          purchaser_email?: string
          purchaser_name?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          redeemed_at?: string | null
          redeemed_by_admin?: string | null
          status?: string
          stripe_session_id?: string | null
          tenant_id?: string | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      catering_orders: {
        Row: {
          billing_city: string | null
          billing_country: string | null
          billing_name: string | null
          billing_street: string | null
          billing_zip: string | null
          calculated_distance_km: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          company_name: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_city: string | null
          delivery_cost: number | null
          delivery_floor: string | null
          delivery_street: string | null
          delivery_zip: string | null
          desired_date: string | null
          desired_time: string | null
          has_elevator: boolean | null
          id: string | null
          internal_notes: string | null
          is_pickup: boolean | null
          is_test: boolean | null
          items: Json | null
          last_customer_message_at: string | null
          last_our_reply_at: string | null
          lexoffice_contact_id: string | null
          lexoffice_credit_note_id: string | null
          lexoffice_document_type: string | null
          lexoffice_invoice_id: string | null
          minimum_order_surcharge: number | null
          notes: string | null
          order_number: string | null
          payment_method: string | null
          payment_status: string | null
          reference_number: string | null
          reminder_sent_at: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          total_amount: number | null
          user_id: string | null
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          billing_city: string | null
          billing_country: string | null
          billing_name: string | null
          billing_street: string | null
          billing_zip: string | null
          company: string | null
          created_at: string | null
          delivery_city: string | null
          delivery_country: string | null
          delivery_floor: string | null
          delivery_street: string | null
          delivery_zip: string | null
          email: string | null
          has_elevator: boolean | null
          id: string | null
          name: string | null
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_city?: never
          billing_country?: never
          billing_name?: never
          billing_street?: never
          billing_zip?: never
          company?: string | null
          created_at?: string | null
          delivery_city?: string | null
          delivery_country?: never
          delivery_floor?: never
          delivery_street?: string | null
          delivery_zip?: string | null
          email?: string | null
          has_elevator?: never
          id?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_city?: never
          billing_country?: never
          billing_name?: never
          billing_street?: never
          billing_zip?: never
          company?: string | null
          created_at?: string | null
          delivery_city?: string | null
          delivery_country?: never
          delivery_floor?: never
          delivery_street?: string | null
          delivery_zip?: string | null
          email?: string | null
          has_elevator?: never
          id?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_messages: {
        Row: {
          attachments: Json | null
          bcc_email: string | null
          body_html: string | null
          body_text: string | null
          cc_email: string | null
          created_at: string | null
          direction: string | null
          from_email: string | null
          id: string | null
          in_reply_to: string | null
          inquiry_id: string | null
          resend_message_id: string | null
          resend_status: string | null
          subject: string | null
          to_email: string | null
        }
        Insert: {
          attachments?: Json | null
          bcc_email?: string | null
          body_html?: string | null
          body_text?: string | null
          cc_email?: string | null
          created_at?: string | null
          direction?: never
          from_email?: string | null
          id?: string | null
          in_reply_to?: string | null
          inquiry_id?: string | null
          resend_message_id?: string | null
          resend_status?: string | null
          subject?: string | null
          to_email?: string | null
        }
        Update: {
          attachments?: Json | null
          bcc_email?: string | null
          body_html?: string | null
          body_text?: string | null
          cc_email?: string | null
          created_at?: string | null
          direction?: never
          from_email?: string | null
          id?: string | null
          in_reply_to?: string | null
          inquiry_id?: string | null
          resend_message_id?: string | null
          resend_status?: string | null
          subject?: string | null
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_event_emails_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_bookings: {
        Row: {
          booking_number: string | null
          company_name: string | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          event_date: string | null
          event_time: string | null
          guest_count: number | null
          id: string | null
          internal_notes: string | null
          lexoffice_contact_id: string | null
          lexoffice_document_type: string | null
          lexoffice_invoice_id: string | null
          location_id: string | null
          menu_confirmed: boolean | null
          menu_selection: Json | null
          package_id: string | null
          payment_status: string | null
          phone: string | null
          source_inquiry_id: string | null
          source_option_id: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link_id: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_events_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_events_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      event_inquiries: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to: string | null
          balance_due_days_before_event: number | null
          balance_method: string | null
          billing_address_different: boolean | null
          billing_city: string | null
          billing_company_name: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_street: string | null
          company_city: string | null
          company_country: string | null
          company_name: string | null
          company_postal_code: string | null
          company_street: string | null
          contact_name: string | null
          converted_to_booking_id: string | null
          cost_acceptance_id: string | null
          created_at: string | null
          current_offer_version: number | null
          customer_language: string | null
          delivery_city: string | null
          delivery_street: string | null
          delivery_time_slot: string | null
          delivery_zip: string | null
          deposit_amount: number | null
          deposit_due_days: number | null
          deposit_method: string | null
          deposit_percent: number | null
          email: string | null
          email_draft: string | null
          event_end_date: string | null
          event_type: string | null
          guest_count: string | null
          id: string | null
          inquiry_type: Database["public"]["Enums"]["inquiry_type"] | null
          internal_notes: string | null
          invoice_due_days: number | null
          is_test: boolean | null
          last_edited_at: string | null
          last_edited_by: string | null
          lexoffice_invoice_id: string | null
          lexoffice_quotation_id: string | null
          location_city: string | null
          location_country: string | null
          location_name: string | null
          location_postal_code: string | null
          location_street: string | null
          location_type: string | null
          locked_after_signature: boolean | null
          menu_selection: Json | null
          message: string | null
          notification_sent: boolean | null
          offer_phase: string | null
          offer_sent_at: string | null
          offer_sent_by: string | null
          offer_slug: string | null
          offer_validity_days: number | null
          order_confirmation_terms_version: string | null
          order_confirmed_at: string | null
          order_confirmed_by_name: string | null
          order_confirmed_ip: string | null
          order_confirmed_user_agent: string | null
          order_confirmed_version: number | null
          paid_amount: number | null
          payment_method: string | null
          payment_timing: string | null
          payment_type: string | null
          phone: string | null
          preferred_date: string | null
          priority: string | null
          quote_items: Json | null
          quote_notes: string | null
          remaining_amount: number | null
          reminder_count: number | null
          reminder_sent_at: string | null
          room_selection: string | null
          selected_items: Json | null
          selected_option_id: string | null
          selected_packages: Json | null
          source: string | null
          status: string | null
          time_slot: string | null
          updated_at: string | null
          venue: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_events_cost_acceptance_id_fkey"
            columns: ["cost_acceptance_id"]
            isOneToOne: false
            referencedRelation: "cost_acceptances"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payments: {
        Row: {
          amount_cents: number | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          due_days_before_event: number | null
          email_resend_id: string | null
          email_sent_at: string | null
          id: string | null
          inquiry_id: string | null
          lexoffice_invoice_id: string | null
          lexoffice_invoice_number: string | null
          notes: string | null
          paid_at: string | null
          paid_via: string | null
          payment_type: string | null
          reminder_sent_at: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link_url: string | null
          updated_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          due_days_before_event?: number | null
          email_resend_id?: string | null
          email_sent_at?: string | null
          id?: string | null
          inquiry_id?: string | null
          lexoffice_invoice_id?: string | null
          lexoffice_invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_via?: string | null
          payment_type?: never
          reminder_sent_at?: string | null
          status?: never
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_url?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          due_days_before_event?: number | null
          email_resend_id?: string | null
          email_sent_at?: string | null
          id?: string | null
          inquiry_id?: string | null
          lexoffice_invoice_id?: string | null
          lexoffice_invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_via?: string | null
          payment_type?: never
          reminder_sent_at?: string | null
          status?: never
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_link_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_payments_enriched: {
        Row: {
          amount_cents: number | null
          computed_status: string | null
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          due_date: string | null
          due_days_before_event: number | null
          effective_due_date: string | null
          email_resend_id: string | null
          email_sent_at: string | null
          event_date: string | null
          event_type: string | null
          guest_count: number | null
          id: string | null
          inquiry_id: string | null
          lexoffice_invoice_id: string | null
          lexoffice_invoice_number: string | null
          notes: string | null
          paid_at: string | null
          paid_via: string | null
          payment_type: string | null
          preferred_date: string | null
          reminder_sent_at: string | null
          service_type: string | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link_url: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_comments: {
        Row: {
          author_email: string | null
          content: string | null
          created_at: string | null
          id: string | null
          inquiry_id: string | null
          parent_id: string | null
          updated_at: string | null
        }
        Insert: {
          author_email?: string | null
          content?: string | null
          created_at?: string | null
          id?: string | null
          inquiry_id?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Update: {
          author_email?: string | null
          content?: string | null
          created_at?: string | null
          id?: string | null
          inquiry_id?: string | null
          parent_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_event_comments_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "inquiry_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v2_event_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_offer_history: {
        Row: {
          created_at: string | null
          email_content: string | null
          email_html: string | null
          id: string | null
          inquiry_id: string | null
          options_snapshot: Json | null
          pdf_url: string | null
          sent_at: string | null
          sent_by: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          email_content?: string | null
          email_html?: string | null
          id?: string | null
          inquiry_id?: string | null
          options_snapshot?: Json | null
          pdf_url?: string | null
          sent_at?: string | null
          sent_by?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          email_content?: string | null
          email_html?: string | null
          id?: string | null
          inquiry_id?: string | null
          options_snapshot?: Json | null
          pdf_url?: string | null
          sent_at?: string | null
          sent_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_event_offer_history_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_offer_options: {
        Row: {
          created_at: string | null
          created_in_version: number | null
          guest_count: number | null
          id: string | null
          inquiry_id: string | null
          is_active: boolean | null
          menu_selection: Json | null
          offer_mode: string | null
          offer_version: number | null
          option_label: string | null
          package_id: string | null
          selected_quantity: number | null
          sort_order: number | null
          stripe_payment_link_id: string | null
          stripe_payment_link_url: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_in_version?: number | null
          guest_count?: number | null
          id?: string | null
          inquiry_id?: string | null
          is_active?: boolean | null
          menu_selection?: Json | null
          offer_mode?: never
          offer_version?: number | null
          option_label?: string | null
          package_id?: string | null
          selected_quantity?: never
          sort_order?: number | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_in_version?: number | null
          guest_count?: number | null
          id?: string | null
          inquiry_id?: string | null
          is_active?: boolean | null
          menu_selection?: Json | null
          offer_mode?: never
          offer_version?: number | null
          option_label?: string | null
          package_id?: string | null
          selected_quantity?: never
          sort_order?: number | null
          stripe_payment_link_id?: string | null
          stripe_payment_link_url?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string | null
          inquiry_id: string | null
          priority: string | null
          reminder_sent: boolean | null
          status: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          inquiry_id?: string | null
          priority?: never
          reminder_sent?: boolean | null
          status?: never
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          inquiry_id?: string | null
          priority?: never
          reminder_sent?: boolean | null
          status?: never
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_event_tasks_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_customer_responses: {
        Row: {
          created_at: string | null
          customer_notes: string | null
          id: string | null
          inquiry_id: string | null
          ip_address: string | null
          responded_at: string | null
          selected_option_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          customer_notes?: string | null
          id?: string | null
          inquiry_id?: string | null
          ip_address?: never
          responded_at?: string | null
          selected_option_id?: string | null
          user_agent?: never
        }
        Update: {
          created_at?: string | null
          customer_notes?: string | null
          id?: string | null
          inquiry_id?: string | null
          ip_address?: never
          responded_at?: string | null
          selected_option_id?: string | null
          user_agent?: never
        }
        Relationships: [
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_offer_options_event_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
        ]
      }
      unassigned_inbox_emails: {
        Row: {
          attachment_count: number | null
          body_html: string | null
          body_text: string | null
          cc_emails: string[] | null
          created_at: string | null
          date_received: string | null
          date_sent: string | null
          from_email: string | null
          from_name: string | null
          has_attachments: boolean | null
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string | null
          imap_folder: string | null
          imap_status: string | null
          imap_uid: number | null
          in_reply_to: string | null
          is_hidden: boolean | null
          message_id: string | null
          raw_mime: string | null
          raw_size_bytes: number | null
          references_headers: string[] | null
          reply_to_email: string | null
          status_changed_at: string | null
          status_history: Json | null
          subject: string | null
          to_emails: string[] | null
          updated_at: string | null
        }
        Insert: {
          attachment_count?: number | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string | null
          date_received?: string | null
          date_sent?: string | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string | null
          imap_folder?: string | null
          imap_status?: string | null
          imap_uid?: number | null
          in_reply_to?: string | null
          is_hidden?: boolean | null
          message_id?: string | null
          raw_mime?: string | null
          raw_size_bytes?: number | null
          references_headers?: string[] | null
          reply_to_email?: string | null
          status_changed_at?: string | null
          status_history?: Json | null
          subject?: string | null
          to_emails?: string[] | null
          updated_at?: string | null
        }
        Update: {
          attachment_count?: number | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: string[] | null
          created_at?: string | null
          date_received?: string | null
          date_sent?: string | null
          from_email?: string | null
          from_name?: string | null
          has_attachments?: boolean | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string | null
          imap_folder?: string | null
          imap_status?: string | null
          imap_uid?: number | null
          in_reply_to?: string | null
          is_hidden?: boolean | null
          message_id?: string | null
          raw_mime?: string | null
          raw_size_bytes?: number | null
          references_headers?: string[] | null
          reply_to_email?: string | null
          status_changed_at?: string | null
          status_history?: Json | null
          subject?: string | null
          to_emails?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_purge_candidates_ai_conversations: {
        Row: {
          age_days: number | null
          created_at: string | null
          customer_email: string | null
          id: string | null
          inquiry_id: string | null
        }
        Insert: {
          age_days?: never
          created_at?: string | null
          customer_email?: string | null
          id?: string | null
          inquiry_id?: string | null
        }
        Update: {
          age_days?: never
          created_at?: string | null
          customer_email?: string | null
          id?: string | null
          inquiry_id?: string | null
        }
        Relationships: []
      }
      v_purge_candidates_attachments: {
        Row: {
          age_days: number | null
          created_at: string | null
          id: string | null
          inquiry_id: string | null
          storage_bucket: string | null
          storage_path: string | null
        }
        Insert: {
          age_days?: never
          created_at?: string | null
          id?: string | null
          inquiry_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
        }
        Update: {
          age_days?: never
          created_at?: string | null
          id?: string | null
          inquiry_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
        }
        Relationships: []
      }
      v_purge_candidates_email_logs: {
        Row: {
          age_days: number | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string | null
        }
        Insert: {
          age_days?: never
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
        }
        Update: {
          age_days?: never
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string | null
        }
        Relationships: []
      }
      v_purge_candidates_inquiry: {
        Row: {
          age_days: number | null
          created_at: string | null
          customer_id: string | null
          event_id: string | null
          service_type: Database["public"]["Enums"]["v2_event_service"] | null
          source: Database["public"]["Enums"]["v2_event_source"] | null
          status: Database["public"]["Enums"]["v2_event_status"] | null
          updated_at: string | null
        }
        Insert: {
          age_days?: never
          created_at?: string | null
          customer_id?: string | null
          event_id?: string | null
          service_type?: Database["public"]["Enums"]["v2_event_service"] | null
          source?: Database["public"]["Enums"]["v2_event_source"] | null
          status?: Database["public"]["Enums"]["v2_event_status"] | null
          updated_at?: string | null
        }
        Update: {
          age_days?: never
          created_at?: string | null
          customer_id?: string | null
          event_id?: string | null
          service_type?: Database["public"]["Enums"]["v2_event_service"] | null
          source?: Database["public"]["Enums"]["v2_event_source"] | null
          status?: Database["public"]["Enums"]["v2_event_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v2_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_payments_enriched: {
        Row: {
          amount_cents: number | null
          computed_status: string | null
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          due_date: string | null
          due_days_before_event: number | null
          effective_due_date: string | null
          email_resend_id: string | null
          email_sent_at: string | null
          event_date: string | null
          event_id: string | null
          guest_count: number | null
          id: string | null
          lexoffice_invoice_id: string | null
          lexoffice_invoice_number: string | null
          location: Database["public"]["Enums"]["v2_event_location"] | null
          notes: string | null
          paid_at: string | null
          paid_via: string | null
          payment_type: Database["public"]["Enums"]["v2_payment_type"] | null
          reminder_sent_at: string | null
          service_type: Database["public"]["Enums"]["v2_event_service"] | null
          source_booking_payment_id: string | null
          source_offer_option_id: string | null
          source_payment_id: string | null
          status: Database["public"]["Enums"]["v2_payment_status"] | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_link_url: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "catering_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "event_inquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v_purge_candidates_inquiry"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "v2_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "v2_events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _fmt_address: {
        Args: {
          city: string
          country?: string
          floor_?: string
          street: string
          zip: string
        }
        Returns: string
      }
      _fmt_bool: { Args: { b: boolean }; Returns: string }
      _fmt_date: { Args: { d: string }; Returns: string }
      _fmt_money: { Args: { n: number }; Returns: string }
      _fmt_text: { Args: { t: string }; Returns: string }
      _log_field_change: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_field: string
          p_group: string
          p_label: string
          p_new_display: string
          p_old_display: string
        }
        Returns: undefined
      }
      append_email_status_history: {
        Args: { p_email_id: string; p_folder?: string; p_new_status: string }
        Returns: undefined
      }
      checkout_create_catering_order: {
        Args: { payload: Json }
        Returns: string
      }
      checkout_create_event_booking: {
        Args: { payload: Json }
        Returns: string
      }
      confirm_offline_booking: {
        Args: { p_inquiry_id: string; p_selected_option_id: string }
        Returns: Json
      }
      confirm_offline_booking_multi: {
        Args: { p_inquiry_id: string; p_option_quantities: Json }
        Returns: Json
      }
      generate_booking_number: { Args: never; Returns: string }
      get_balance_payment_link_by_slug: {
        Args: { p_slug: string }
        Returns: {
          active: boolean
          created_at: string
          created_by: string | null
          customer_email: string
          customer_name: string | null
          default_guests: number
          deposit_paid_cents: number
          event_date: string | null
          event_id: string | null
          event_label: string
          event_label_en: string | null
          id: string
          max_guests: number
          min_guests: number
          notes: string | null
          price_per_person_cents: number
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "balance_payment_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_event_emails: {
        Args: { p_event_id: string; p_include_hidden?: boolean }
        Returns: {
          attachment_count: number
          body_html: string
          body_text: string
          date_at: string
          from_email: string
          from_name: string
          has_attachments: boolean
          id: string
          imap_folder: string
          imap_status: string
          is_excluded: boolean
          is_hidden: boolean
          message_id: string
          source: string
          status_changed_at: string
          subject: string
        }[]
      }
      get_next_order_number: {
        Args: { p_prefix: string; p_year: number }
        Returns: number
      }
      get_public_offer: { Args: { offer_id: string }; Returns: Json }
      get_public_offer_by_slug: { Args: { slug: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      purge_deleted_menu_items: { Args: never; Returns: undefined }
      report_frontend_error: {
        Args: {
          p_message: string
          p_payload?: Json
          p_severity: string
          p_source: string
          p_url?: string
          p_user_agent?: string
        }
        Returns: string
      }
      report_system_error_internal: {
        Args: {
          p_message: string
          p_payload: Json
          p_payload_hash: string
          p_project: Database["public"]["Enums"]["project_key"]
          p_severity: string
          p_source: string
          p_url?: string
          p_user_agent?: string
        }
        Returns: {
          count: number
          id: string
          was_new: boolean
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_offer_response: {
        Args: {
          p_customer_notes?: string
          p_inquiry_id: string
          p_selected_option_id: string
        }
        Returns: Json
      }
      track_offer_view: { Args: { p_slug: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "staff"
      inquiry_type: "event" | "catering"
      menu_type:
        | "lunch"
        | "food"
        | "drinks"
        | "christmas"
        | "valentines"
        | "special"
        | "catering"
      project_key: "events_storia" | "ristorante_storia"
      v2_email_direction: "inbound" | "outbound"
      v2_event_location: "in_house" | "external"
      v2_event_priority: "low" | "normal" | "high" | "urgent"
      v2_event_service: "restaurant" | "catering" | "hybrid" | "group"
      v2_event_source:
        | "website"
        | "manual"
        | "email_inbound"
        | "phone"
        | "catering_form"
        | "reisegruppen"
        | "email_forward"
      v2_event_status:
        | "inquiry"
        | "offer_draft"
        | "offer_sent"
        | "offer_chosen"
        | "paid"
        | "completed"
        | "offer_declined"
        | "cancelled"
        | "payment_failed"
        | "no_response"
      v2_offer_mode:
        | "alacarte"
        | "partial_menu"
        | "full_menu"
        | "package"
        | "email"
        | "freeform"
      v2_payment_status:
        | "draft"
        | "sent"
        | "paid"
        | "overdue"
        | "cancelled"
        | "refunded"
        | "failed"
      v2_payment_type: "deposit" | "prepayment" | "final" | "full" | "refund"
      v2_task_status: "open" | "in_progress" | "done" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
      inquiry_type: ["event", "catering"],
      menu_type: [
        "lunch",
        "food",
        "drinks",
        "christmas",
        "valentines",
        "special",
        "catering",
      ],
      project_key: ["events_storia", "ristorante_storia"],
      v2_email_direction: ["inbound", "outbound"],
      v2_event_location: ["in_house", "external"],
      v2_event_priority: ["low", "normal", "high", "urgent"],
      v2_event_service: ["restaurant", "catering", "hybrid", "group"],
      v2_event_source: [
        "website",
        "manual",
        "email_inbound",
        "phone",
        "catering_form",
        "reisegruppen",
        "email_forward",
      ],
      v2_event_status: [
        "inquiry",
        "offer_draft",
        "offer_sent",
        "offer_chosen",
        "paid",
        "completed",
        "offer_declined",
        "cancelled",
        "payment_failed",
        "no_response",
      ],
      v2_offer_mode: [
        "alacarte",
        "partial_menu",
        "full_menu",
        "package",
        "email",
        "freeform",
      ],
      v2_payment_status: [
        "draft",
        "sent",
        "paid",
        "overdue",
        "cancelled",
        "refunded",
        "failed",
      ],
      v2_payment_type: ["deposit", "prepayment", "final", "full", "refund"],
      v2_task_status: ["open", "in_progress", "done", "cancelled"],
    },
  },
} as const
